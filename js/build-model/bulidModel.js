/**
 * Created by jiexu on 2017/6/12.
 */
function getStationTree(buildModel,refImageOnly) {
    var stationTree = {};
    stationTree.data = [];
    var workStationList = buildModel.Product.WorkStationList;
    var stationNode = {};
    for(var i=0;i<workStationList.length;i++){
        var workStation = workStationList[i];
        stationNode = {
            "id":workStation.Attribute.ID,
            "text":workStation.Attribute.Name,
            "icon": "fa fa-laptop",
            "nodeType":"workStation"
        };
        var refImageList = workStation.RefImageList;
        var imageList = [];
        var imageNode = {};
        for (var j=0;j<refImageList.length;j++){
            var refImage = refImageList[j];
            imageNode = {
                "id":refImage.Attribute.ID,
                "text":refImage.Attribute.Name,
                "icon": "fa fa-image",
                "nodeType":"refImage",
                "parents":[refImage.Attribute.WorkStationID],
                "state":{"expanded":true},
                "nodes":[]
            };
            // 是否仅解析到参考图？
            if(!refImageOnly){
                var groupList = refImage.GroupList;
                for(var k=0;k<groupList.length;k++){
                    var group = groupList[k];
                    // 更新分组索引
                    if(group.Attribute.ID>=groupIndex){
                        groupIndex = group.Attribute.ID;
                        groupIndex++;
                    }
                    var groupNode = {
                        "id":group.Attribute.ID,
                        "text":group.Attribute.Name,
                        "icon":"fa fa-sitemap",
                        "nodeType":"group",
                        "parents":[workStation.Attribute.ID,refImage.Attribute.ID],
                        "state":{"expanded":true},
                        "nodes":[]
                    }
                    var inspObjList = group.InspObjList;
                    for(var l=0;l<inspObjList.length;l++){
                        var inspObj = inspObjList[l];
                        // 更新对象索引
                        if(inspObj.Attribute.ID>=objectIndex){
                            objectIndex = inspObj.Attribute.ID;
                            objectIndex++;
                        }
                        // 获取当前对象算法信息
                        var methodInfo = findInspMethodById(inspObj.Attribute.InspMethodID);
                        // 翻译算法名
                        var methodName = translate(methodInfo.methodName,methodInfo.languageData);
                        // 对象节点
                        var inspObjNode = {
                            "id":inspObj.Attribute.ID,
                            "text":inspObj.Attribute.Name,
                            "icon":"fa fa-cube",
                            "nodeType":"object",
                            "parents":[workStation.Attribute.ID,refImage.Attribute.ID,group.Attribute.ID],
                            "state":{"expanded":true},
                            nodes:[
                                {
                                    text: methodName,
                                    icon: "fa fa-gear",
                                    nodeType: "inspMethod",
                                    methodId: inspObj.Attribute.InspMethodID,
                                    parents:[workStation.Attribute.ID,refImage.Attribute.ID,group.Attribute.ID,inspObj.Attribute.ID]
                                },
                                {
                                    text: "",
                                    icon: "fa fa-pencil-square-o",
                                    nodeType:"region",
                                    parents:[workStation.Attribute.ID,refImage.Attribute.ID,group.Attribute.ID,inspObj.Attribute.ID]
                                }
                            ]
                        }
                        groupNode.nodes.push(inspObjNode);
                    }
                    imageNode.nodes.push(groupNode);
                }
            }
            imageList.push(imageNode);
        }
        stationNode.nodes = imageList;
        stationTree.data.push(stationNode);
    }
    return stationTree;
}

function getGraphList(){
    var graphList = new Array;
    var workStationList = buildModel.Product.WorkStationList;
    for(var i=0;i<workStationList.length;i++){
        var workStation = workStationList[i];
        var refImageList = workStation.RefImageList;
        for (var j=0;j<refImageList.length;j++){
            var refImage = refImageList[j];
            var groupList = refImage.GroupList;
            for(var k=0;k<groupList.length;k++){
                var regionList = groupList[k].RegionList;
                // 循环建模数据中所有的regionList
                for(var l=0;l<regionList.length;l++){
                    var graphId = parseInt(regionList[l].Attribute.ID);
                    var outer = regionList[l].Outer.split(",");
                    var tempPointList = [];
                    for(var outerIndex=0;outerIndex<outer.length;){
                        var imageX=parseInt(outer[outerIndex]);
                        var imageY=parseInt(outer[outerIndex+1]);
                        var canvasPoint = getCanvasPoint(options.focalPoint,imageX,imageY);
                        tempPointList.push({
                            canvasX:canvasPoint.canvasX,
                            canvasY:canvasPoint.canvasY,
                            imageX:imageX,
                            imageY:imageY
                        });
                        outerIndex=outerIndex+2;
                    }
                    // 更新图形索引
                    if(graphId>=graphIndex){
                        graphIndex = graphId;
                        graphIndex++;
                    }
                    var graphObject = {
                        id : graphId,
                        graphType : "polygon",
                        isSelected : false,
                        pointList : tempPointList,
                        // 当前画图形时背景位图的偏移量
                        currentDeg : deg,
                        // 当前压缩比
                        compressRatio: compressRatio
                    }
                    graphList.push(graphObject);
                }
            }
        }

    }
    return graphList;
}