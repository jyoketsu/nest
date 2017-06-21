/**
 * Created by jiexu on 2017/6/9.
 */
// 获取json数据
function getJson(url,async){
    var result = "";
    $.ajax({
        url: url,
        data: "",
        async: async,
        success: function(data){
            result=data;
        },
        dataType: "json",
        contentType: "application/x-www-form-urlencoded; charset=utf-8"
    });
    return result;
}

// 获取json数据
function getString(url,async){
    var result = "";
    $.ajax({
        url: url,
        data: "",
        async: async,
        success: function(data){
            result=data;
        },
        dataType: "text",
        contentType: "application/x-www-form-urlencoded; charset=utf-8"
    });
    return result;
}

// 提交json数据
function postJson(data){
    $.ajax({
        type: 'POST',
        url: "http://192.168.13.14:9090/servlet-demo/ProductServlet",
        data: data,
        success: function(data){},
        dataType: "json",
        contentType: "application/x-www-form-urlencoded; charset=utf-8"
    });
    
}