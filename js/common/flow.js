/**
 * Created by jiexu on 2017/6/9.
 */
function initFlow(configUrl) {
    var flow = getJson(configUrl,false);
    var currentFlow = flow.flows[0];
    $.extend(true,flow.currentFlow,currentFlow);
    // 将数据保存到session中
    sessionStorage.setItem("buildModel-flow",JSON.stringify(flow));
    redirect(flow.flows,0);
}

function redirect(flows,index) {
    location.href = "./"+flows[index].id+".html";;
}

function preFlow() {
    var flow = JSON.parse(sessionStorage.getItem("buildModel-flow"));
    var currentFlow = flow.currentFlow;
    var flows = flow.flows;
    var currentIndex = getArrayIndex(flows,currentFlow);
    if(currentIndex!=0){
        $.extend(true,flow.currentFlow,flows[currentIndex-1]);
        // 将数据保存到session中
        sessionStorage.setItem("buildModel-flow",JSON.stringify(flow));
        redirect(flows,currentIndex-1);
    }
}

function nextFlow() {
    var flow = JSON.parse(sessionStorage.getItem("buildModel-flow"));
    var currentFlow = flow.currentFlow;
    var flows = flow.flows;
    var currentIndex = getArrayIndex(flows,currentFlow);
    if(currentIndex+1!=flows.length){
        $.extend(true,flow.currentFlow,flows[currentIndex+1]);
        // 将数据保存到session中
        sessionStorage.setItem("buildModel-flow",JSON.stringify(flow));
        redirect(flows,currentIndex+1);
    } else {
        var prePage = sessionStorage.getItem("prePage");
        if(prePage == "product-info"){
            window.location.href = "../product-info/product-info.html";
        } else if (prePage == "product-detect"){
            window.location.href = "../product-detect/product-detect.html";
        }
    }
}

function getArrayIndex(array,item){
    for(var i=0;i<array.length;i++){
        if(array[i].id==item.id){
            return i;
            break;
        }
    }
}

