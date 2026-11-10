const nav = require("./nav");
const scrollbar = require("./scrollbar");
const i18n = require("./i18n");

function definePage(config) {
  const user = {
    onReady: config.onReady,
    onShow: config.onShow,
    onHide: config.onHide,
    onScroll: config.onScroll,
    goHome: config.goHome,
  };

  const page = Object.assign({}, config);
  page.data = Object.assign(
    {},
    config.data || {},
    { T: i18n.pageText(config.page || "") },
    scrollbar.createState()
  );

  page.onReady = function () {
    nav.ready();
    scrollbar.measure(this);
    if (user.onReady) user.onReady.call(this);
  };

  page.onShow = function () {
    nav.reset();
    if (config.titleKey && !i18n.isDefaultLocale()) {
      i18n.setNavTitle(config.titleKey);
    }
    if (user.onShow) user.onShow.call(this);
  };

  page.onHide = function () {
    nav.reset();
    if (user.onHide) user.onHide.call(this);
  };

  page.onScroll = function (e) {
    scrollbar.onScroll(this, e);
    if (user.onScroll) user.onScroll.call(this, e);
  };

  if (config.home !== false) {
    page.goHome = function () {
      if (user.goHome) user.goHome.call(this);
      else nav.relaunch("/pages/index/index");
    };
  } else {
    delete page.goHome;
  }
  delete page.home;
  delete page.page;
  delete page.titleKey;

  Page(page);
  return page;
}

module.exports = {
  definePage,
};
