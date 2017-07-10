/**
 * Created by jiexu on 2017/6/12.
 */

// 从根array中寻找指定对象，参数为包含此对象在内id及其所有父节点的id
function findObjectInArray(array,parentsIds){
    var ids = [];
    var tempIds = getBuildModelStructure();

    for(var i=0;i<parentsIds.length;i++){
        ids.push({
            id:parentsIds[i],
            childNodeName:tempIds[i].childNodeName
        });
    }

    var index = 0;

    var array = listLoop(array);

    function listLoop(array){
        for(var i=0;i<array.length;i++){
            var info = ids[index];
            if(array[i].Attribute.ID == info.id){
                if(index+1==ids.length){
                    return array[i];
                } else {
                    array = eval("array[i]."+info.childNodeName);
                    index++;
                    return listLoop(array);
                }
            }
        }
    }

    return array;
}

// 从根treenode中寻找指定节点，参数为包含此对象在内id及其所有父节点的id
function findNodeInTreeNode(ids){
    var index = 0;

    var array = listLoop(treeNode.data);

    function listLoop(array){
        for(var i=0;i<array.length;i++){
            if(array[i].id == ids[index]){
                if(index+1==ids.length){
                    return array[i];
                } else {
                    array = array[i].nodes;
                    index++;
                    return listLoop(array);
                }
            }
        }
    }

    return array;
}

// 获取建模结构
function getBuildModelStructure(){
    return [
        {
            arrayName:"stationList",
            childNodeName:"RefImageList"
        },
        {
            arrayName:"refImageList",
            childNodeName:"GroupList"
        },
        {
            arrayName:"groupList",
            childNodeName:"InspObjList"
        },
        {
            arrayName:"inspObjList",
            childNodeName:""
        }
    ]
}

// 根据建模数据结构获取工位树数据结构；refImageOnly：是否仅获取到参考图节点
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
                                    text: "region",
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

// 根据选中节点获取当前选中对象的信息
function getObjectInfoBySelectedNode(selectedNode){
    // 获取当前对象信息
    var objectIds = [selectedNode.parents[0],selectedNode.parents[1],selectedNode.parents[2]];
    // 当前选中的节点是对象
    if(selectedNode.nodeType=="object"){
        objectIds.push(selectedNode.id);
    } else {
        objectIds.push(selectedNode.parents[3]);
    }
    var currentObject = findObjectInArray(buildModel.Product.WorkStationList,objectIds);
    // 对象信息
    var objectInfo = {
        ID:currentObject.Attribute.ID,
        WorkStationID:selectedNode.parents[0],
        RefImageID:selectedNode.parents[1],
        GroupID:selectedNode.parents[2],
        InspMethodID:currentObject.Attribute.InspMethodID
    }
    return objectInfo;
}

// 获取建模数据中所有的region
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
                    // 外轮廓
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

                    // 内轮廓
                    var tempPointList2 = [];
                    if(regionList[l].Inner && regionList[l].Inner.length>0){
                        for(var listIndex=0;listIndex<regionList[l].Inner.length;listIndex++){
                            var inner = regionList[l].Inner[listIndex].split(",");

                            var innerPoints=[];
                            for(var innerIndex=0;innerIndex<inner.length;){
                                var imageX=parseInt(inner[innerIndex]);
                                var imageY=parseInt(inner[innerIndex+1]);
                                var canvasPoint = getCanvasPoint(options.focalPoint,imageX,imageY);
                                innerPoints.push({
                                    canvasX:canvasPoint.canvasX,
                                    canvasY:canvasPoint.canvasY,
                                    imageX:imageX,
                                    imageY:imageY
                                });
                                innerIndex=innerIndex+2;
                            }
                            tempPointList2.push(innerPoints);
                        }
                    }

                    var graphObject = {
                        id : graphId,
                        graphType : "polygon",
                        isSelected : false,
                        pointList : tempPointList,
                        innerPoints : tempPointList2,
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

// 点的转换:OuterToPoint
function outerToPoint(region){
    var graphId = parseInt(region.Attribute.ID);
    var outer = region.Outer.split(",");
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

    // 内轮廓
    var tempPointList2 = [];
    if(region.Inner && region.Inner.length>0){
        for(var listIndex=0;listIndex<region.Inner.length;listIndex++){
            var inner = region.Inner[listIndex].split(",");

            var innerPoints=[];
            for(var innerIndex=0;innerIndex<inner.length;){
                var imageX=parseInt(inner[innerIndex]);
                var imageY=parseInt(inner[innerIndex+1]);
                var canvasPoint = getCanvasPoint(options.focalPoint,imageX,imageY);
                innerPoints.push({
                    canvasX:canvasPoint.canvasX,
                    canvasY:canvasPoint.canvasY,
                    imageX:imageX,
                    imageY:imageY
                });
                innerIndex=innerIndex+2;
            }
            tempPointList2.push(innerPoints);
        }
    }

    return {
        id : graphId,
        graphType : "polygon",
        isSelected : false,
        pointList : tempPointList,
        innerPoints : tempPointList2,
        // 当前画图形时背景位图的偏移量
        currentDeg : deg,
        // 当前压缩比
        compressRatio: compressRatio
    }
}

// 点的转换:pointToOuter
function pointToOuter(pointList){
    var outer="";
    if(pointList){
        for(var i=0;i<pointList.length;i++){
            var point = pointList[i];
            outer+=Math.round(point.imageX)+","+Math.round(point.imageY)+","
        }
        outer = outer.substring(0,outer.length-1);
    }
    return outer;
}

// 根据对象id在指定参考图下搜索对象
function findObjectInRefImg(stationList,imgIds,objectId){
    var targetRefImg = findObjectInArray(stationList,imgIds);
    var groupList = targetRefImg.GroupList;
    for(var i=0;i<groupList.length;i++){
        var inspObjList = groupList[i].InspObjList;
        for(var j=0;j<inspObjList.length;j++){
            if(objectId == inspObjList[j].Attribute.ID){
                return inspObjList[j];
            }
        }
    }
}