/**
 * products 集合 - 商品
 * @typedef {Object} Product
 * @property {string} _id
 * @property {string} brand - 品牌，如"农夫山泉"
 * @property {string} productName - 商品名，如"饮用天然水"
 * @property {string} fullName - brand + productName，搜索用
 * @property {string} [barcode] - 条形码，如"6921168509256"
 * @property {string} [category] - 分类，如"饮料/水"
 * @property {Date} createTime
 */

/**
 * barcodes 集合 - 条码查询缓存
 * @typedef {Object} BarcodeCache
 * @property {string} _id
 * @property {string} barcode - 条码值
 * @property {string} brand - 品牌
 * @property {string} name - 商品名
 * @property {string} spec - 规格文字，如"550ml"
 * @property {number} [price] - 参考价
 * @property {string} [image] - 商品图片URL
 * @property {Object} [rawData] - API原始返回
 * @property {Date} createTime
 */

/**
 * specs 集合 - 规格
 * @typedef {Object} Spec
 * @property {string} _id
 * @property {string} productId - 关联 products._id
 * @property {string} spec - 如 "550ml" 或 "550ml×12瓶"
 * @property {string} specUnit - 单位 g / ml / 个 / 包
 * @property {number} specValue - 总量（单件=单件值，多件=单件×件数）
 * @property {number} [pieceCount] - 件数（可选，如12瓶）
 * @property {string} [pieceUnit] - 件单位（可选，如"瓶"）
 * @property {number} [pieceSpecValue] - 每件含量（可选，如550）
 * @property {Date} createTime
 */

/**
 * prices 集合 - 价格记录
 * @typedef {Object} Price
 * @property {string} _id
 * @property {string} specId - 关联 specs._id
 * @property {string} platformCategory - "online" | "offline"
 * @property {string} platform - 平台，如"京东"
 * @property {string} shopName - 店铺名
 * @property {number} price - 总价
 * @property {number} unitPrice - 单价（自动计算）
 * @property {Date} recordDate - 记录日期
 * @property {Date} createTime
 */

module.exports = {};
