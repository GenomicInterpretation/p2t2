require("./view_d3.js");
jQuery.fn.d3Click = function () {
    this.each(function (i, e) {
      var evt = new MouseEvent("click");
      e.dispatchEvent(evt);
    });
};