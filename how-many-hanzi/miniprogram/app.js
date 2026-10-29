const storage = require("./lib/storage");

App({
  globalData: {
    env: "cloud1-9gfoqx5va6f33a45",
  },
  onLaunch() {
    storage.migrate();
    if (wx.cloud) {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
