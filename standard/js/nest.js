/**
 * Created by jiexu on 2017/5/24.
 */
$(document).ready(function () {
    if($(".nest-head")){
        // 获取nest-head高度
        var headHeight = $(".nest-head").outerHeight();
        // 设置nest-content位置
        $(".nest-content-flow").css("top",headHeight+"px");
        $(".nest-content").css("top",headHeight+"px");
    }

    // 获取nest-footer高度
    if($(".nest-footer")){
        var footerHeight = $(".nest-footer").outerHeight();
        // 设置nest-content位置
        $(".nest-content-flow").css("bottom",footerHeight+"px");
        $(".nest-content").css("bottom",footerHeight+"px");
    }
});