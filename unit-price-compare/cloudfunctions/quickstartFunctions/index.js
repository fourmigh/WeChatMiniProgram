const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const axios = require("axios");

const BARCODE_API_URL = "https://v1.apizero.cn/api/barcode-lookup";

exports.main = async (event) => {
  const { type, data } = event;

  switch (type) {
    // 获取商品详情（含 specs + prices）
    case "getProductDetail": {
      const { productId } = data;
      const product = await db.collection("products").doc(productId).get();
      const specs = await db.collection("specs")
        .where({ productId })
        .orderBy("createTime", "desc")
        .get();

      for (const spec of specs.data) {
        const prices = await db.collection("prices")
          .where({ specId: spec._id })
          .orderBy("unitPrice", "asc")
          .get();
        spec.prices = prices.data;
      }

      return { product: product.data, specs: specs.data };
    }

    // 搜索商品
    case "searchProducts": {
      const { keyword } = data;
      const res = await db.collection("products")
        .where({
          fullName: db.RegExp({
            regexp: keyword,
            options: "i",
          }),
        })
        .orderBy("createTime", "desc")
        .get();
      return { products: res.data };
    }

    // 条码查询（带缓存）
    case "lookupBarcode": {
      const { barcode } = data;
      if (!barcode || !/^\d{8,14}$/.test(barcode)) {
        return { error: "invalid barcode" };
      }

      // 1. 查缓存
      try {
        const cacheRes = await db.collection("barcodes")
          .where({ barcode })
          .limit(1)
          .get();
        if (cacheRes.data.length > 0) {
          const cached = cacheRes.data[0];
          return {
            found: true,
            brand: cached.brand,
            name: cached.name,
            spec: cached.spec,
            price: cached.price,
            image: cached.image,
            cached: true,
          };
        }
      } catch (e) {
        // 集合可能不存在，继续查 API
      }

      // 2. 调用 ApiZero API
      try {
        const res = await axios.get(BARCODE_API_URL, {
          params: { barcode },
          timeout: 5000,
        });

        if (res.data && res.data.code === 0 && res.data.data && res.data.data.found) {
          const info = res.data.data;

          // 写入缓存（异步，不阻塞返回）
          db.collection("barcodes").add({
            data: {
              barcode,
              brand: info.brand || "",
              name: info.name || "",
              spec: info.spec || "",
              price: info.price || null,
              image: info.image || "",
              rawData: info,
              createTime: db.serverDate(),
            },
          }).catch(() => {});

          return {
            found: true,
            brand: info.brand || "",
            name: info.name || "",
            spec: info.spec || "",
            price: info.price,
            image: info.image || "",
            cached: false,
          };
        }

        return { found: false };
      } catch (e) {
        return { error: "api error", message: e.message };
      }
    }

    default:
      return { error: "unknown type" };
  }
};
