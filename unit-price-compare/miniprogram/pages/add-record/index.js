const { t, getLocale } = require("../../shared/i18n/index");
const { PLATFORM_CATEGORIES, PLATFORMS, SPEC_UNITS, PIECE_UNITS, BARCODE_REGEX, parseSpecText } = require("../../shared/constants");

Page({
  data: {
    _t: getLocale(),
    isQuickAdd: false,
    existingProductId: "",
    existingSpecs: [],
    specOptions: [],
    specSelectIndex: 0,
    categoryIndex: 0,
    platformCategories: PLATFORM_CATEGORIES,
    platforms: PLATFORMS.online,
    platformsByCategory: PLATFORMS,
    platformIndex: 0,
    specUnits: SPEC_UNITS,
    pieceUnits: PIECE_UNITS,
    brand: "",
    productName: "",
    shopName: "",
    spec: "",
    specUnitIndex: 0,
    specValue: "",
    pieceCount: "",
    pieceUnitIndex: 0,
    price: "",
    unitPriceText: "",
    perPieceText: "",
    customPlatform: "",
    showCustomPlatform: false,
    isFormValid: false,
    saving: false,
    isEdit: false,
    priceId: "",
    deleting: false,
    barcode: "",
    barcodeLoading: false,
    barcodeResult: null,
    refPrice: "",
  },
  onLoad(options) {
    if (options.priceId) {
      this.loadPrice(options.priceId);
    } else if (options.id) {
      this.loadProduct(options.id);
    } else {
      wx.setNavigationBarTitle({ title: t("add.navTitle") });
      if (options.barcode && BARCODE_REGEX.test(options.barcode)) {
        this.setData({ barcode: options.barcode });
        this.lookupBarcode(options.barcode);
      }
      this.checkFormValid();
    }
  },
  async loadPrice(priceId) {
    const db = wx.cloud.database();
    try {
      const priceRes = await db.collection("prices").doc(priceId).get();
      const price = priceRes.data;
      const specRes = await db.collection("specs").doc(price.specId).get();
      const spec = specRes.data;
      const productRes = await db.collection("products").doc(spec.productId).get();
      const product = productRes.data;

      wx.setNavigationBarTitle({ title: t("add.editNavTitle") });

      const specsRes = await db.collection("specs").where({ productId: spec.productId }).get();
      const existingSpecs = specsRes.data;
      const specOptions = existingSpecs.map(s => ({ label: s.spec, isNew: false }));
      specOptions.push({ label: t("quickAdd.newSpec"), isNew: true });

      const specIdx = existingSpecs.findIndex(s => s._id === price.specId);
      const catIdx = PLATFORM_CATEGORIES.findIndex(c => c.key === price.platformCategory);
      const catKey = PLATFORM_CATEGORIES[catIdx >= 0 ? catIdx : 0].key;
      const platformsList = PLATFORMS[catKey];
      const pIdx = platformsList.indexOf(price.platform);

      this.setData({
        isQuickAdd: true,
        isEdit: true,
        priceId,
        existingProductId: product._id,
        existingSpecs,
        specOptions,
        brand: product.brand,
        productName: product.productName,
        categoryIndex: catIdx >= 0 ? catIdx : 0,
        platforms: platformsList,
        platformIndex: pIdx >= 0 ? pIdx : 0,
        showCustomPlatform: pIdx < 0,
        customPlatform: pIdx < 0 ? price.platform : "",
        shopName: price.shopName,
        price: String(price.price),
        specSelectIndex: specIdx >= 0 ? specIdx : 0,
      });
      this.onSpecSelectChange({ detail: { value: specIdx >= 0 ? specIdx : 0 } });
      this.calcPreview();
      this.checkFormValid();
    } catch (e) {
      wx.showToast({ title: t("detail.loadFail"), icon: "none" });
      wx.navigateBack();
    }
  },
  async loadProduct(productId) {
    const db = wx.cloud.database();
    try {
      const productRes = await db.collection("products").doc(productId).get();
      const product = productRes.data;
      wx.setNavigationBarTitle({ title: t("quickAdd.navTitle", { name: product.fullName }) });
      const specRes = await db.collection("specs").where({ productId }).get();
      const existingSpecs = specRes.data;
      const specOptions = existingSpecs.map(s => ({ label: s.spec, isNew: false }));
      specOptions.push({ label: t("quickAdd.newSpec"), isNew: true });

      // 加载最近一条价格记录作为默认值
      let defaults = {};
      if (existingSpecs.length > 0) {
        const _ = db.command;
        const specIds = existingSpecs.map(s => s._id);
        const priceRes = await db.collection("prices")
          .where({ specId: _.in(specIds) })
          .orderBy("createTime", "desc")
          .limit(1)
          .get();
        if (priceRes.data.length > 0) {
          const last = priceRes.data[0];
          const catIdx = PLATFORM_CATEGORIES.findIndex(c => c.key === last.platformCategory);
          const catKey = PLATFORM_CATEGORIES[catIdx >= 0 ? catIdx : 0].key;
          const platformsList = PLATFORMS[catKey];
          const pIdx = platformsList.indexOf(last.platform);
          defaults = {
            categoryIndex: catIdx >= 0 ? catIdx : 0,
            platforms: platformsList,
            platformIndex: pIdx >= 0 ? pIdx : 0,
            showCustomPlatform: pIdx < 0,
            customPlatform: pIdx < 0 ? last.platform : "",
            shopName: last.shopName,
          };
          const specIdx = existingSpecs.findIndex(s => s._id === last.specId);
          if (specIdx >= 0) defaults.specSelectIndex = specIdx;
        }
      }

      this.setData({
        isQuickAdd: true,
        existingProductId: productId,
        existingSpecs,
        specOptions,
        brand: product.brand,
        productName: product.productName,
        ...defaults,
      });
      this.onSpecSelectChange({ detail: { value: defaults.specSelectIndex || 0 } });
    } catch (e) {
      wx.showToast({ title: t("detail.loadFail"), icon: "none" });
      wx.navigateBack();
    }
  },
  onSpecSelectChange(e) {
    const index = e.detail.value;
    const { existingSpecs } = this.data;
    const selected = existingSpecs[index];

    if (selected) {
      const specUnitIndex = SPEC_UNITS.findIndex(u => u.value === selected.specUnit);
      this.setData({
        specSelectIndex: index,
        specValue: String(selected.specValue),
        specUnitIndex: specUnitIndex >= 0 ? specUnitIndex : 0,
        spec: selected.spec,
        pieceCount: selected.pieceCount ? String(selected.pieceCount) : "",
        pieceUnitIndex: selected.pieceUnit ? PIECE_UNITS.indexOf(selected.pieceUnit) : 0,
      });
    } else {
      this.setData({
        specSelectIndex: index,
        specValue: "",
        specUnitIndex: 0,
        spec: "",
        pieceCount: "",
        pieceUnitIndex: 0,
      });
    }
    this.calcPreview();
    this.checkFormValid();
  },
  checkFormValid() {
    const { brand, productName, shopName, specValue, spec, price, showCustomPlatform, customPlatform } = this.data;
    const valid = !!(brand && productName && shopName && spec && Number(specValue) > 0 && Number(price) > 0 && (!showCustomPlatform || customPlatform));
    this.setData({ isFormValid: valid });
  },
  onBrandInput(e) {
    this.setData({ brand: e.detail.value });
    this.checkFormValid();
  },
  onProductNameInput(e) {
    this.setData({ productName: e.detail.value });
    this.checkFormValid();
  },
  onCategoryChange(e) {
    const categoryIndex = e.detail.value;
    const key = PLATFORM_CATEGORIES[categoryIndex].key;
    this.setData({
      categoryIndex,
      platforms: PLATFORMS[key],
      platformIndex: 0,
      showCustomPlatform: false,
      customPlatform: "",
    });
    this.checkFormValid();
  },
  onPlatformChange(e) {
    const platformIndex = e.detail.value;
    const isOther = this.data.platforms[platformIndex] === "其他";
    this.setData({ platformIndex, showCustomPlatform: isOther });
    this.checkFormValid();
  },
  onShopNameInput(e) {
    this.setData({ shopName: e.detail.value });
    this.checkFormValid();
  },
  onSpecChange(e) {
    this.setData({ spec: e.detail.value });
    this.checkFormValid();
  },
  onSpecUnitChange(e) {
    const specUnitIndex = e.detail.value;
    const { specValue, specUnits } = this.data;
    const spec = specValue + specUnits[specUnitIndex].value;
    this.setData({ specUnitIndex, spec });
    this.calcPreview();
    this.checkFormValid();
  },
  onSpecValueInput(e) {
    const specValue = e.detail.value;
    const { specUnitIndex, specUnits } = this.data;
    const spec = specValue + specUnits[specUnitIndex].value;
    this.setData({ specValue, spec });
    this.calcPreview();
    this.checkFormValid();
  },
  onPieceCountInput(e) {
    this.setData({ pieceCount: e.detail.value });
    this.calcPreview();
  },
  onPieceUnitChange(e) {
    this.setData({ pieceUnitIndex: e.detail.value });
    this.calcPreview();
  },
  onCustomPlatformInput(e) {
    this.setData({ customPlatform: e.detail.value });
    this.checkFormValid();
  },
  onPriceInput(e) {
    this.setData({ price: e.detail.value });
    this.calcPreview();
    this.checkFormValid();
  },
  onBarcodeInput(e) {
    this.setData({ barcode: e.detail.value, barcodeResult: null });
  },
  onBarcodeBtnTap() {
    if (this.data.barcode) {
      this.onBarcodeConfirm();
    } else {
      this.onScanBarcode();
    }
  },
  onBarcodeConfirm() {
    const { barcode } = this.data;
    if (barcode && BARCODE_REGEX.test(barcode)) {
      this.lookupBarcode(barcode);
    }
  },
  onScanBarcode() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ["barCode"],
      success: (res) => {
        if (res.result && BARCODE_REGEX.test(res.result)) {
          this.setData({ barcode: res.result, barcodeResult: null });
          this.lookupBarcode(res.result);
        } else {
          wx.showToast({ title: t("add.barcodeNotFound"), icon: "none" });
        }
      },
    });
  },
  async lookupBarcode(barcode) {
    this.setData({ barcodeLoading: true, barcodeResult: null });
    try {
      const res = await wx.cloud.callFunction({
        name: "quickstartFunctions",
        data: { type: "lookupBarcode", data: { barcode } },
      });
      const result = res.result;
      if (result.error) {
        this.setData({ barcodeLoading: false, barcodeResult: false });
        return;
      }
      if (result.found) {
        this.fillFromBarcode(result);
        this.setData({ barcodeLoading: false, barcodeResult: true });
      } else {
        this.setData({ barcodeLoading: false, barcodeResult: false });
      }
    } catch (e) {
      this.setData({ barcodeLoading: false, barcodeResult: false });
    }
  },
  fillFromBarcode(data) {
    const update = {};
    if (data.brand) update.brand = data.brand;
    if (data.name) {
      let productName = data.name;
      if (data.brand && productName.startsWith(data.brand)) {
        productName = productName.slice(data.brand.length);
      }
      if (data.spec && productName.endsWith(data.spec)) {
        productName = productName.slice(0, -data.spec.length);
      }
      productName = productName.replace(/^\s+|\s+$/g, "");
      update.productName = productName || data.name;
    }
    if (data.spec) {
      const parsed = parseSpecText(data.spec);
      if (parsed) {
        const unitIdx = SPEC_UNITS.findIndex(u => u.value === parsed.specUnit);
        update.specUnitIndex = unitIdx >= 0 ? unitIdx : 0;
        update.specValue = String(parsed.specValue);
        update.spec = data.spec;
        if (parsed.pieceCount) {
          update.pieceCount = String(parsed.pieceCount);
          const pUnitIdx = PIECE_UNITS.indexOf(parsed.pieceUnit);
          update.pieceUnitIndex = pUnitIdx >= 0 ? pUnitIdx : 0;
        }
      } else {
        update.spec = data.spec;
      }
    }
    if (data.price) update.refPrice = "¥" + Number(data.price).toFixed(2);
    this.setData(update);
    this.calcPreview();
    this.checkFormValid();
  },
  calcPreview() {
    const { price, specValue, specUnitIndex, specUnits, pieceCount, pieceUnitIndex, pieceUnits } = this.data;
    const specUnit = specUnits[specUnitIndex].value;
    const nPrice = Number(price);
    const nSpec = Number(specValue);
    const nPiece = Number(pieceCount);

    if (nPrice && nSpec) {
      const totalSpec = nPiece > 0 ? nSpec * nPiece : nSpec;
      const unitPrice = nPrice / totalSpec;
      const text = t("add.unitPricePreview", { price: unitPrice.toFixed(4), unit: specUnit });
      this.setData({ unitPriceText: text });

      if (nPiece > 0) {
        const perPiece = nPrice / nPiece;
        this.setData({
          perPieceText: t("add.perPiece", {
            price: perPiece.toFixed(2),
            unit: pieceUnits[pieceUnitIndex],
          }),
        });
      } else {
        this.setData({ perPieceText: "" });
      }
    } else {
      this.setData({ unitPriceText: "", perPieceText: "" });
    }
  },
  async onSubmit() {
    const {
      isQuickAdd, existingProductId, existingSpecs, specSelectIndex,
      categoryIndex, platformCategories, platformIndex, platforms,
      brand, productName, shopName,
      spec, specUnitIndex, specUnits, specValue,
      pieceCount, pieceUnitIndex, pieceUnits,
      price, customPlatform, showCustomPlatform,
      isEdit, priceId,
    } = this.data;
    if (!brand || !productName || !shopName || !spec || !specValue || !price) {
      wx.showToast({ title: t("add.formIncomplete"), icon: "none" });
      return;
    }
    if (showCustomPlatform && !customPlatform) {
      wx.showToast({ title: t("add.customPlatformRequired"), icon: "none" });
      return;
    }

    this.setData({ saving: true });
    const db = wx.cloud.database();
    const specUnit = specUnits[specUnitIndex].value;
    const nSpecValue = Number(specValue);
    const nPiece = Number(pieceCount);
    const nPrice = Number(price);
    const hasPiece = nPiece > 0 && pieceUnitIndex >= 0;
    const totalSpecValue = hasPiece ? nSpecValue * nPiece : nSpecValue;
    const specKey = hasPiece ? `${nSpecValue}${specUnit}×${nPiece}${pieceUnits[pieceUnitIndex]}` : spec;
    const unitPrice = nPrice / totalSpecValue;
    const platformName = showCustomPlatform ? customPlatform : platforms[platformIndex];

    try {
      // 获取或创建 product
      let productId = existingProductId;
      if (!productId) {
        const fullName = brand + productName;
        const productRes = await db.collection("products").where({ fullName }).get();
        if (productRes.data.length > 0) {
          productId = productRes.data[0]._id;
        } else {
          const productData = { brand, productName, fullName, createTime: db.serverDate() };
          if (this.data.barcode && BARCODE_REGEX.test(this.data.barcode)) {
            productData.barcode = this.data.barcode;
          }
          const addRes = await db.collection("products").add({ data: productData });
          productId = addRes._id;
        }
      }

      // 获取或创建 spec
      let specId;
      if (isQuickAdd && existingSpecs[specSelectIndex]) {
        specId = existingSpecs[specSelectIndex]._id;
      } else {
        const specRes = await db.collection("specs").where({ productId, spec: specKey }).get();
        if (specRes.data.length > 0) {
          specId = specRes.data[0]._id;
        } else {
          const specData = {
            productId,
            spec: specKey,
            specUnit,
            specValue: totalSpecValue,
            createTime: db.serverDate(),
          };
          if (hasPiece) {
            specData.pieceCount = nPiece;
            specData.pieceUnit = pieceUnits[pieceUnitIndex];
            specData.pieceSpecValue = nSpecValue;
          }
          const addRes = await db.collection("specs").add({ data: specData });
          specId = addRes._id;
        }
      }

      // 查重（编辑态排除自身）
      const dupRes = await db.collection("prices").where({
        specId,
        platform: platformName,
        shopName,
        price: nPrice,
      }).get();
      const isDuplicate = isEdit
        ? dupRes.data.some((d) => d._id !== priceId)
        : dupRes.data.length > 0;
      if (isDuplicate) {
        wx.showToast({ title: t("add.duplicateRecord"), icon: "none" });
        this.setData({ saving: false });
        return;
      }

      const priceData = {
        specId,
        platformCategory: platformCategories[categoryIndex].key,
        platform: platformName,
        shopName,
        price: nPrice,
        unitPrice,
        recordDate: db.serverDate(),
      };

      // 写入 price（编辑态更新，否则新增）
      if (isEdit) {
        await db.collection("prices").doc(priceId).update({ data: priceData });
      } else {
        await db.collection("prices").add({
          data: { ...priceData, createTime: db.serverDate() },
        });
      }

      wx.showToast({ title: isEdit ? t("add.updateSuccess") : t("add.success") });
      wx.navigateBack();
    } catch (e) {
      wx.showToast({ title: t("add.fail"), icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
  onDeleteRecord() {
    const { priceId } = this.data;
    wx.showModal({
      title: t("add.delete"),
      content: t("add.deleteRecordConfirm"),
      confirmText: t("add.delete"),
      confirmColor: "#e53935",
      success: (res) => {
        if (res.confirm) this.deletePriceRecord(priceId);
      },
    });
  },
  async deletePriceRecord(priceId) {
    const db = wx.cloud.database();
    this.setData({ deleting: true });
    try {
      const priceRes = await db.collection("prices").doc(priceId).get();
      const specId = priceRes.data.specId;
      await db.collection("prices").doc(priceId).remove();
      const remainRes = await db.collection("prices").where({ specId }).count();
      if (remainRes.total === 0) {
        await db.collection("specs").doc(specId).remove();
      }
      wx.showToast({ title: t("add.deleteSuccess") });
      wx.navigateBack();
    } catch (e) {
      wx.showToast({ title: t("add.deleteFail"), icon: "none" });
    } finally {
      this.setData({ deleting: false });
    }
  },
});
