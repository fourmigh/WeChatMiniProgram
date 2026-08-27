Component({
  properties: {
    value: { type: String, value: "" },
    options: { type: Array, value: [] },
    placeholder: { type: String, value: "" },
    disabled: { type: Boolean, value: false },
    filterMode: { type: String, value: "contains" },
  },
  data: {
    text: "",
    open: false,
    filtered: [],
  },
  lifetimes: {
    attached() {
      this.setData({ text: this.data.value });
    },
  },
  observers: {
    value(val) {
      this.setData({ text: val });
      if (this.data.open) {
        this.filter(val);
      }
    },
  },
  methods: {
    filter(keyword) {
      const kw = (keyword || "").trim().toLowerCase();
      const opts = this.data.options || [];
      let list;
      if (!kw) {
        list = opts.slice(0, 20);
      } else if (this.data.filterMode === "prefix") {
        list = opts.filter((o) => o && o.toLowerCase().indexOf(kw) === 0).slice(0, 20);
      } else {
        list = opts.filter((o) => o && o.toLowerCase().indexOf(kw) !== -1).slice(0, 20);
      }
      this.setData({ filtered: list });
    },
    onInput(e) {
      const v = e.detail.value;
      this.setData({ text: v, open: true });
      this.filter(v);
      this.triggerEvent("change", { value: v });
    },
    onArrowTap() {
      if (this.data.disabled) return;
      const open = !this.data.open;
      if (open) this.filter(this.data.text);
      this.setData({ open });
    },
    onSelect(e) {
      const v = e.currentTarget.dataset.value;
      this.setData({ text: v, open: false });
      this.triggerEvent("change", { value: v });
      this.triggerEvent("select", { value: v });
    },
    onMaskTap() {
      this.setData({ open: false });
    },
  },
});
