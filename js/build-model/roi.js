/**
 * Created by jiexu on 2017/6/19.
 */
//背景画布
var canvas_bg;
var context_bg;
//蒙版画布
var canvas_bak;
var context_bak;
//画布
var canvas;
var context;

var canvasWidth;
var canvasHeight;

var canvasTop;
var canvasLeft;

//画笔大小
var size = 1;
var color = '#000000';

// 绘制的图形的集合
var graphList;
// 初始绘制的图形的集合
var originGraphList;

// 选中的图形
var previousSelectedGraph = null;

// 拖拽
var isDragging = false;
var picDragging = false;

// 圆角矩形半径
var roundRectRadius = 10;

var fileInput;

// 位图，背景图
var img = null;
// 压缩比
var compressRatio = 1;
// 位图选项
var options = null;

// 旋转角度
var deg = 0;

// 图层数
var canvasNum = 2;
// 最大图层id
var maxCoverageId;

var offscreenCanvas;
var offscreenContext;

// 图形索引，用作图形id
var graphIndex = 0;

// 判断是否可以新增roi
function checkAddRoi(){
    if(selectedNode.nodeType){
        if(selectedNode.nodeType=="workStation"||selectedNode.nodeType=="refImage"){
            alert("请选择一分组");
            return false;
        }else{
            return true;
        }
    }else{
        alert("请选择一分组");
        return false;
    }
}

// 新增roi数据至buildModel数据
function addRegionToBuildModel(graphObject){
    var outer="";
    for(var i=0;i<graphObject.pointList.length;i++){
        var point = graphObject.pointList[i];
        outer+=Math.round(point.imageX)+","+Math.round(point.imageY)+","
    }
    outer = outer.substring(0,outer.length-1);
    var region = {
        Attribute:{
            ID:graphObject.id,
            NoteID:""
        },
        Outer:outer
    }

    var ids = [];
    var currentGroup;
    $.extend(true,ids,selectedNode.parents);
    // 当前选中的节点是分组
    if(selectedNode.nodeType=="group"){
        ids.push(selectedNode.id);
        // 分组数据
        currentGroup = findObjectInArray(buildModel.Product.WorkStationList,ids);
        currentGroup.RegionList.push(region);
        // 记录图形所在的工位-参考图-分组-对象id
        ids.push(objectIndex);
        graphObject.ids = ids;
        // 新增对象
        addObject(graphObject.id);
        // 选中ROI
        selectGraphById(graphObject.id);
    } else if(selectedNode.nodeType=="object"){ // 当前选中的节点是对象
        currentGroup = findObjectInArray(buildModel.Product.WorkStationList,ids);
        currentGroup.RegionList.push(region);
        ids.push(selectedNode.id);
        var currentObject = findObjectInArray(buildModel.Product.WorkStationList,ids);
        currentObject.RegionIDList.push({ID:graphObject.id});
        // 记录图形所在的工位-参考图-分组-对象id
        graphObject.ids = ids;
    } else if(selectedNode.nodeType=="inspMethod" || selectedNode.nodeType=="region"){ // 当前选中的节点是对象子节点
        var currentObject = findObjectInArray(buildModel.Product.WorkStationList,ids);
        currentObject.RegionIDList.push({ID:graphObject.id});
        // 记录图形所在的工位-参考图-分组-对象id
        var objectIds = [];
        $.extend(true,objectIds,ids);
        graphObject.ids = objectIds;
        // 分组数据 RegionList
        ids.splice(ids.length-1,1);
        currentGroup = findObjectInArray(buildModel.Product.WorkStationList,ids);
        currentGroup.RegionList.push(region);
    }
}

// 选中树节点
function selectNode(currentGraph){
    // 寻找使用当前检测区的对象节点
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



    /*var node = findNodeInTreeNode(previousSelectedGraph.ids);
    selectedNode.state.selected=false;
    node.state.selected=true;
    $('#tree').treeview(treeNode);
    selectedNode = node;
    $('#tree').treeview(treeNode);
    treeEvent();
    selecttreeNode();*/
}

$(document).ready(function(){
    // 初始化画布
    initCanvas();
    // 设置画布大小
    setCanvasSize();
    // 初始化图像和图形
    initPic("./../../product/test/Station1-C1-0.bmp",null);

    // 绘制矩形
    $("#newSquare").on("click",function () {
        if(checkAddRoi()){
            mouseDraft("newROI","square");
        }
    });
    // 绘制多边形
    $("#newPolygon").on("click",function () {
        if(checkAddRoi()){
            mouseDraft("newROI","polygon");
        }
    });
    // 选择ROI
    $("#selectRoi").on("click",function () {
        // 图形：选中
        selectGraph();

    });
    // 删除
    $("#deleteRoi").on("click",function () {
        deleteGraph();
    });

    // 缩放：原图大小
    $("#fitOrigin").on("click",function () {
        zoomPic("origin");
    });
    // 缩放：适应高度
    $("#fitHeight").on("click",function () {
        zoomPic("height");
    });
    // 缩放：适应宽度
    $("#fitWidth").on("click",function () {
        zoomPic("width");
    });
    // 缩放：适应窗口
    $("#fitWindow").on("click",function () {
        zoomPic("window");
    });
    // 缩放：放大
    $("#zoomIn").on("click",function () {
        zoomPic("zoom-in");
    });
    // 缩放：缩小
    $("#zoomOut").on("click",function () {
        zoomPic("zoom-out");
    });

});

// 初始化画布
function initCanvas() {
    // 初期化画布
    this.canvas_bg =  document.getElementById("canvas_bg");
    this.context_bg = this.canvas_bg.getContext('2d');

    // 初期化蒙版
    this.canvas_bak =  document.getElementById("canvas_bak");
    this.context_bak = this.canvas_bak.getContext('2d');

    // 画布坐标
    this.canvasTop = $(this.canvas_bg).offset().top;
    this.canvasLeft = $(this.canvas_bg).offset().left;

    // 图形集合
    this.graphList = new Array();

    // todo this.fileInput = $('#fileInput')[0];
    // 改变鼠标样式
    this.changeCursor("not-allowed");

    this.offscreenCanvas = document.getElementById("canvas_compress");
    this.offscreenContext = this.offscreenCanvas.getContext('2d');
}

// 设置画布大小
function setCanvasSize(){
    this.canvasWidth = $('.canvas_container').innerWidth();
    this.canvasHeight = $('.canvas_container').innerHeight();

    this.canvas_bg.width = this.canvasWidth;
    this.canvas_bg.height = this.canvasHeight;

    this.canvas_bak.width = this.canvasWidth;
    this.canvas_bak.height = this.canvasHeight;
    this.context_bak.fillStyle = 'rgba(127,255,170,0.3)';

    this.offscreenCanvas.width = this.canvasWidth;
    this.offscreenCanvas.height = this.canvasHeight;
}

// 初期显示
function initPic (result,graphList) {
    let startTime = new Date().getTime();

    // todo 清空图形和ROI
    // this.clearContext("all",null);
    // 显示加载模态框
    $("#canvasLoadingModal").modal("show");
    this.img = new Image();
    this.img.crossOrigin = "anonymous";

    let that = this;
    this.img.onload = function() {
        let endTime = new Date().getTime();
        console.log("-----image load time : ");
        console.log((endTime - startTime)/1000);

        // 图片长宽比
        let ratio = that.img.width / that.img.height;
        // canvas长宽比
        let canvasRatio = that.canvasWidth / that.canvasHeight;
        // 绘制的宽度和高度
        let iw = (ratio < canvasRatio) ? that.img.width*(that.canvasHeight/that.img.height) : that.canvasWidth;
        let ih = (ratio < canvasRatio) ? that.canvasHeight : that.img.height*(that.canvasWidth/that.img.width);

        that.offscreenCanvas.width = that.img.width;
        that.offscreenCanvas.height = that.img.height;

        let drawStime = new Date().getTime();
        that.offscreenContext.drawImage(that.img,0,0,that.img.width,that.img.height);
        let drawEtime = new Date().getTime();
        console.log("-----draw offscreenCanvas time : ");
        console.log((drawEtime - drawStime)/1000);

        // 初期化绘图参数
        that.options = new Object();
        that.options.iw = iw;
        that.options.ih = ih;
        that.options.ratio = ratio;
        that.options.canvasRatio = canvasRatio;
        that.options.scale = 1;
        // 原图与显示图的缩放比例
        that.options.zoomRatio = that.img.width / (iw*that.options.scale);
        // 中点
        that.options.midpoint = {
            canvasX : that.canvasWidth/2,
            canvasY : that.canvasHeight/2,
            imageX : that.img.width/2,
            imageY : that.img.height/2
        };
        // 焦点
        that.options.focalPoint = {
            canvasX : that.canvasWidth/2,
            canvasY : that.canvasHeight/2,
            imageX : that.img.width/2,
            imageY : that.img.height/2
        };

        // 绘制背景图片
        drawStime = new Date().getTime();
        paintPic(that.options);
        drawEtime = new Date().getTime();
        console.log("-----draw image time : ");
        console.log((drawEtime - drawStime)/1000);
        console.log("-----draw image total time : ");
        console.log((drawEtime - startTime)/1000);

        graphList = getGraphList();

        // 绘制图形
        if (graphList) {
            // 获取最大图层id
            that.maxCoverageId = 0;
            graphList.forEach(function (graph) {
                if(graph.coverageId > that.maxCoverageId){
                    that.maxCoverageId = graph.coverageId;
                }
            });
            that.graphList = graphList;
            // 遍历所有图形
            for (let i=0;i<that.graphList.length;i++) {
                let currentGraph = that.graphList[i];
                // 绘制图形
                that.drawGraph(currentGraph,null);
            }
        }

        // 隐藏加载模态框
        $("#canvasLoadingModal").modal("hide");
    };
    this.img.src = result;
}

// 绘制位图
function paintPic (options) {
    if (this.img != null) {
        let scale = options.scale;
        let iw = options.iw;
        let ih = options.ih;

        // 设置x,y坐标，以焦点缩放
        let canvasX = this.options.focalPoint.canvasX;
        let canvasY = this.options.focalPoint.canvasY;
        let imageX = this.options.focalPoint.imageX;
        let imageY = this.options.focalPoint.imageY;

        let x = canvasX - iw*scale*(imageX/this.img.width);
        let y = canvasY - ih*scale*(imageY/this.img.height);

        let drawContextStime = new Date().getTime();

        this.context_bg.save();
        // 位移：将图像中点设为canvas原点
        this.context_bg.translate(this.options.midpoint.canvasX,this.options.midpoint.canvasY);
        // 旋转
        this.context_bg.rotate(this.deg*Math.PI/180);
        this.context_bg.drawImage(this.offscreenCanvas, x - this.options.midpoint.canvasX, y - this.options.midpoint.canvasY, iw*scale, ih*scale);
        //this.context_bg.drawImage(this.img, x - this.options.midpoint.canvasX, y - this.options.midpoint.canvasY, iw*scale, ih*scale);
        this.context_bg.restore();

        let drawContextEtime = new Date().getTime();
    }
}

// 鼠标绘制图形
function mouseDraft(msg,graphType){
    let that = this;

    let startX;
    let startY;
    let canDraw = false;

    // 绘制前必须先加载位图
    if (that.img == null) {
        alert("请先选择图片！");
        return;
    }
    // 当是擦除或者扩充时，必须先选中ROI
    if (msg=="eraseROI"||msg=="expandROI") {
        if (that.previousSelectedGraph == null) {
            alert("请先选中一个ROI！");
            return;
        }
    }

    // 图形点集
    let pointList = new Array();
    let mousedownTime;
    let mouseupTime;

    // 改变鼠标样式
    that.changeCursor("crosshair");

    //鼠标按下获取 开始xy开始画图
    let mousedown = function(e){
        clearTimeout(mousedownTime);
        mousedownTime = setTimeout(function() {
            let scroolTop = $(window).scrollTop();
            let scroolLeft = $(window).scrollLeft();
            that.canvasTop = $(that.canvas_bg).offset().top - scroolTop;
            that.canvasLeft = $(that.canvas_bg).offset().left - scroolLeft;

            that.context_bak.strokeStyle= that.color;
            that.context_bak.strokeStyle= that.color;
            that.context_bak.lineWidth = that.size;

            startX = e.clientX - that.canvasLeft;
            startY = e.clientY - that.canvasTop;

            // 判断是否在位图背景范围内
            if (!that.isPointInPic(startX,startY)) {
                return;
            }

            // 起始点(多边形的场合，每个顶点)
            pointList.push({
                canvasX : startX,
                canvasY : startY
            });

            canDraw = true;

            // 阻止点击时的cursor的变化，draw
            e=e||window.event;
            e.preventDefault();
        }, 200);
    }

    // 鼠标移动
    let  mousemove = function(e){
        if (canDraw) {
            let scroolTop = $(window).scrollTop();
            let scroolLeft = $(window).scrollLeft();
            that.canvasTop = $(that.canvas_bg).offset().top - scroolTop;
            that.canvasLeft = $(that.canvas_bg).offset().left - scroolLeft;
            e=e||window.event;
            let endX = e.clientX   - that.canvasLeft;
            let endY = e.clientY  - that.canvasTop;
            // 直线
            if (graphType =='line') {
                that.clearContext("bak",null);
                pointList[1] = {canvasX:endX,canvasY:endY};
                that.drawLine(pointList,that.context_bak,{rotateX:0,rotateY:0},true);
                // 矩形
            } else if (graphType =='square') {
                that.clearContext("bak",null);
                pointList[1] = {canvasX:endX,canvasY:endY};
                that.drawSquare(pointList,that.context_bak,{rotateX:0,rotateY:0},true);
                // 圆角矩形
            } else if (graphType =='roundRect') {
                that.clearContext("bak",null);
                pointList[1] = {canvasX:endX,canvasY:endY};
                that.drawRoundRect(pointList,that.roundRectRadius,that.context_bak,{rotateX:0,rotateY:0},true);
                // 椭圆
            } else if (graphType =='oval') {
                that.clearContext("bak",null);
                pointList[1] = {canvasX:endX,canvasY:endY};
                that.drawOval(pointList,that.context_bak,{rotateX:0,rotateY:0},true);
                // 多边形
            } else if (graphType =='polygon') {
                that.clearContext("bak",null);
                that.drawPolygon(pointList,that.context_bak,{rotateX:0,rotateY:0},true,{endX:endX,endY:endY});
            }
        }
    };

    //鼠标离开
    let mouseup = function(e){
        clearTimeout(mouseupTime);
        mouseupTime = setTimeout(function() {
            e=e||window.event;
            // 终点坐标
            let endX = e.clientX   - that.canvasLeft;
            let endY = e.clientY  - that.canvasTop;

            // 判断是否在位图背景范围内
            if (!that.isPointInPic(endX,endY)) {
                return;
            }

            if (graphType !='polygon') {
                if (canDraw) {
                    canDraw = false;
                    // 清空蒙版
                    that.clearContext("bak",null);

                    // 生成参数
                    let graphObject = new Object();

                    // 获得image坐标
                    for (let i=0;i<pointList.length;i++) {
                        let currentPoint = pointList[i];
                        // 获得image坐标
                        let imagePoint = that.getImagePoint(that.options.midpoint,currentPoint.canvasX,currentPoint.canvasY);
                        currentPoint.imageX = imagePoint.imageX;
                        currentPoint.imageY = imagePoint.imageY;
                    }

                    if(graphType =='square'){
                        var tempPointList = new Array(4);
                        var startPoint = pointList[0];
                        var endPoint = pointList[1];
                        var point1={},point2={},point3={},point4={};
                        $.extend(true,point1,startPoint);
                        $.extend(true,point3,endPoint);

                        $.extend(true,point2,startPoint);
                        point2.canvasX = endPoint.canvasX;
                        point2.imageX = endPoint.imageX;

                        $.extend(true,point4,endPoint);
                        point4.canvasX = startPoint.canvasX;
                        point4.imageX = startPoint.imageX;

                        tempPointList = [point1,point2,point3,point4];

                        graphObject = {
                            id : graphIndex,
                            graphType : "polygon",
                            isSelected : false,
                            pointList : tempPointList,
                            // 当前画图形时背景位图的偏移量
                            currentDeg : that.deg,
                            // 当前压缩比
                            compressRatio: that.compressRatio
                        }
                    } else {
                        let tempPointList = $.extend(true,[],pointList);

                        graphObject = {
                            id : graphIndex,
                            graphType : graphType,
                            isSelected : false,
                            pointList : tempPointList,
                            // 当前画图形时背景位图的偏移量
                            currentDeg : that.deg,
                            // 当前压缩比
                            compressRatio: that.compressRatio
                        }
                    }

                    graphIndex++;
                    // 清空点集
                    pointList.length = 0;

                    // 绘制ROI
                    console.log("graphObject",graphObject);
                    drawProcessedGraph("drawGraph",graphObject);

                    // 新增roi数据至buildModel数据
                    addRegionToBuildModel(graphObject);
                }
            }
            e.preventDefault();
        }, 200);
    };

    // 鼠标双击
    let dblclick = function(e) {
        clearTimeout(mousedownTime);
        clearTimeout(mouseupTime);

        let clickX = e.clientX - that.canvasLeft;
        let clickY = e.clientY - that.canvasTop;
        pointList.push({
            canvasX : clickX,
            canvasY : clickY
        });

        canDraw = false;
        // 清空蒙版
        that.clearContext("bak",null);
        // 生成参数
        let graphObject = new Object();

        for (let i=0;i<pointList.length;i++) {
            let currentPoint = pointList[i];
            // 获得image坐标
            let imagePoint = that.getImagePoint(that.options.midpoint,currentPoint.canvasX,currentPoint.canvasY);
            currentPoint.imageX = imagePoint.imageX;
            currentPoint.imageY = imagePoint.imageY;
        }

        let tempPointList = $.extend(true,[],pointList);

        graphObject = {
            id : graphIndex,
            graphType : graphType,
            isSelected : false,
            pointList : tempPointList,
            // 当前画图形时背景位图的偏移量
            currentDeg : that.deg
        }
        graphIndex++;

        // 绘制ROI
        console.log("graphObject",graphObject);
        drawProcessedGraph("drawGraph",graphObject);

        // 新增roi数据至buildModel数据
        addRegionToBuildModel(graphObject);

        // 清空多边形点集
        pointList.length = 0;
        $(that.canvas_bak).unbind();
        // 改变鼠标样式
        that.changeCursor("not-allowed");
    }

    $(that.canvas_bak).unbind();
    $(that.canvas_bak).bind('mousedown',mousedown);
    $(that.canvas_bak).bind('mousemove',mousemove);
    $(that.canvas_bak).bind('mouseup',mouseup);
    $(that.canvas_bak).bind('dblclick',dblclick);
}

// 绘制图形
function drawProcessedGraph(msg,graphObject){
    let that = this;
    if (msg=="drawGraph" || msg=="expandFinish") {
        // 绘制图形
        that.drawGraph(graphObject,null);
        // 保存图形对象
        that.graphList.push(graphObject);
    } else if (msg = "eraseFinish") {
        // 删除选中的图形
        that.context.clearRect(0,0,that.canvasWidth,that.canvasHeight);
        // 绘制新图形
        that.drawGraph(graphObject,null);

        // 保存图形对象
        // 选中图形的索引
        let index = that.graphList.indexOf(that.previousSelectedGraph);
        // 从图形集合中删除当前图形
        that.graphList.splice(index,1);
        // 插入新图形
        that.graphList.splice(index,0,graphObject);
    }

}

// 获取参数，在画布上绘制图形
function drawGraph(graphObject,context){
    let ctx = null;
    let newPath = true;

    if (context) {
        ctx = context;
        newPath = false;
    } else {
        // 图层id为空，新绘制一个图形
        if (!graphObject.coverageId) {
            let coverageId = 1+graphObject.id + 1;
            graphObject.coverageId = coverageId;
            // 创建图层，将图层放在蒙版前一层
            $("#canvas_bak").before('<canvas id="canvas_' +coverageId+'" class="absoluteCenter" style="position: absolute;z-index: '+coverageId+';"></canvas>');
            this.canvas = document.getElementById("canvas_"+coverageId);
            this.canvas.width = this.canvasWidth;
            this.canvas.height = this.canvasHeight;
            this.context = this.canvas.getContext('2d');
            ctx = this.context;
            $("#canvas_bak").css("z-index",coverageId+1);
        } else {
            // 图层id不为空，绘制图形列表中的图形
            this.canvas = document.getElementById("canvas_" + graphObject.coverageId);
            if (!this.canvas) {
                // 创建图层，将图层放在蒙版前一层
                $("#canvas_bak").before('<canvas id="canvas_' +graphObject.coverageId+'" class="absoluteCenter" style="position: absolute;z-index: '+graphObject.coverageId+';"></canvas>');
                this.canvas = document.getElementById("canvas_"+graphObject.coverageId);
                this.canvas.width = this.canvasWidth;
                this.canvas.height = this.canvasHeight;
                $("#canvas_bak").css("z-index",this.maxCoverageId+1);
            }
            this.context = this.canvas.getContext('2d');
            ctx = this.context;

        }
    }

    let graphType = graphObject.graphType;
    let currentDeg = graphObject.currentDeg;

    // 填充颜色
    let color;
    if (graphObject.color) {
        color = graphObject.color;
    } else {
        color = "127,255,170";
    }
    // 如果选中，改变线条和填充颜色
    if (!context) {
        if (graphObject.isSelected) {
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba('+color+',0.7)';
        }
        else {
            ctx.lineWidth = 1;
            ctx.fillStyle = 'rgba('+color+',0.3)';
        }
    }

    // 以中点为旋转点
    let rotatePoint = {
        rotateX:this.options.midpoint.canvasX,
        rotateY:this.options.midpoint.canvasY
    };

    ctx.save();
    // 位移：将旋转点设为canvas原点
    ctx.translate(rotatePoint.rotateX,rotatePoint.rotateY);
    // 旋转
    ctx.rotate((this.deg-currentDeg)*Math.PI/180);

    // 直线
    if (graphType =='line') {
        this.drawLine(graphObject.pointList,ctx,rotatePoint,newPath);
        // 矩形
    } else if (graphType =='square') {
        this.drawSquare(graphObject.pointList,ctx,rotatePoint,newPath);
        // 圆角矩形
    } else if (graphType =='roundRect') {
        this.drawRoundRect(graphObject.pointList,this.roundRectRadius,ctx,rotatePoint,newPath);
        // 椭圆
    } else if (graphType =='oval') {
        this.drawOval(graphObject.pointList,ctx,rotatePoint,newPath);
        // 多边形
    } else if (graphType =='polygon') {
        this.drawPolygon(graphObject.pointList,ctx,rotatePoint,newPath,null);
    }
    // 图形编号
    /*if (graphObject.id) {
        this.drawGraphId(graphObject,rotatePoint,ctx);
    }*/

    ctx.restore();

    // 包含要擦除的图形
    if (graphObject.compositeType && graphObject.compositeType == "erasure") {
        ctx.beginPath();
        for (let i=0;i<graphObject.childGraphs.length;i++) {
            this.drawGraph(graphObject.childGraphs[i],ctx);
        }
        ctx.closePath();
        ctx.save();
        ctx.clip();
        ctx.clearRect(0,0,this.canvasWidth,this.canvasHeight);
        ctx.restore();
    }
}

// 绘制复数图形
function drawGraphs(graphList){
    // 清除所有内容，准备绘制
    this.clearContext("redraw");

    // 绘制图像
    this.paintPic(this.options);

    // 遍历所有图形
    for (let i=0;i<graphList.length;i++) {
        let currentGraph = graphList[i];
        // 绘制图形
        this.drawGraph(currentGraph);
    }
}

// 选择事件
function selectGraph() {
    let that = this;
    if (that.img == null) {
        alert("请先选择图片！");
        return;
    }
    let clickX;
    let clickY;
    // 改变鼠标样式
    that.changeCursor("pointer");
    // 鼠标点击事件
    let canvasClick = function(e){
        // 取得画布上被单击的点
        let scroolTop = $(window).scrollTop();
        let scroolLeft = $(window).scrollLeft();
        that.canvasTop = $(that.canvas_bg).offset().top - scroolTop;
        that.canvasLeft = $(that.canvas_bg).offset().left - scroolLeft;

        clickX = e.clientX   - that.canvasLeft;
        clickY = e.clientY  - that.canvasTop;

        // 点击点设为新的焦点
        if (that.isPointInPic(clickX,clickY)) {
            let imagePoint = that.getImagePoint(that.options.focalPoint,clickX,clickY);
            that.options.focalPoint = {
                canvasX : clickX,
                canvasY : clickY,
                imageX : imagePoint.imageX,
                imageY : imagePoint.imageY
            }
        }

        // 以中点为旋转点
        let rotatePoint = {
            rotateX:that.options.midpoint.canvasX,
            rotateY:that.options.midpoint.canvasY
        };

        // 遍历图形集合,查找被点击的图形
        for (let i=that.graphList.length-1;i>=0;i--) {
            let currentGraph = that.graphList[i];

            // 直线
            if (currentGraph.graphType == 'line') {
                let flag = that.isPointOnLine(currentGraph,clickX,clickY,rotatePoint);
                // 选中图形
                if (flag) {
                    that.selected(currentGraph,null);
                    return;
                }
                // 矩形
            } else if (currentGraph.graphType == 'square') {
                let flag = that.isPointInRect(currentGraph,clickX,clickY,rotatePoint);
                // 选中图形
                if (flag) {
                    that.selected(currentGraph,null);
                    // 工位树选中
                    selectNode();
                    return;
                }
                // 圆角矩形
            } else if (currentGraph.graphType == 'roundRect') {
                let flag = that.isPointInRoundRect(currentGraph,that.roundRectRadius,clickX,clickY,rotatePoint);
                // 选中图形
                if (flag) {
                    that.selected(currentGraph,null);
                    return;
                }
                // 椭圆
            } else if (currentGraph.graphType == 'oval') {
                let flag = that.isPointInOval(currentGraph,clickX,clickY,rotatePoint);
                // 选中图形
                if (flag) {
                    that.selected(currentGraph,null);
                    return;
                }
                // 多边形
            } else if (currentGraph.graphType == 'polygon') {
                let flag = that.isPointInPolygon(currentGraph,clickX,clickY,rotatePoint);
                // 选中图形
                if (flag) {
                    that.selected(currentGraph,null);
                    // 工位树选中
                    selectNode();
                    return;
                }
            }
        }
        // 没有选中任何图形，并且在位图区域内，则选中位图
        if (!that.isDragging && that.isPointInPic(clickX,clickY)) {
            // 改变鼠标样式
            that.changeCursor("move");
            // 清除之前选择的图形
            if (that.previousSelectedGraph != null) {
                that.previousSelectedGraph.isSelected = false;
                // 更新显示
                that.clearContext("content",that.previousSelectedGraph.coverageId);
                that.drawGraph(that.previousSelectedGraph);
            }
            // 选中位图
            if (that.img != null) {
                that.picDragging = true;
            }
        }
    };

    // 停止拖拽
    let stopDragging = function() {
        // 改变鼠标样式
        that.changeCursor("pointer");
        // 拖动的是图形
        if (that.isDragging == true) {
            // 更新图形的相对于图像(位图)的坐标
            let pointList = that.previousSelectedGraph.pointList;
            for (let index=0;index<pointList.length;index++) {
                let point = that.getImagePoint (that.options.midpoint,pointList[index].canvasX,pointList[index].canvasY);
                pointList[index].imageX = point.imageX;
                pointList[index].imageY = point.imageY;
            }
            // 如果包含要擦除的图形
            if (that.previousSelectedGraph.compositeType
                && that.previousSelectedGraph.compositeType == "erasure") {
                for (let i=0;i<that.previousSelectedGraph.childGraphs.length;i++) {
                    let currentPointList = that.previousSelectedGraph.childGraphs[i].pointList;
                    for (let j=0;j<currentPointList.length;j++) {
                        let point = that.getImagePoint (that.options.midpoint,currentPointList[j].canvasX,currentPointList[j].canvasY);
                        currentPointList[j].imageX = point.imageX;
                        currentPointList[j].imageY = point.imageY;
                    }
                }
            }
            that.isDragging = false;

            /*// 发送消息，将拖动后的图形数据发送给外部函数
            that.publishSubscribeService.publish("afterMoveGraph",that.previousSelectedGraph);*/
            // 拖动的是图像
        } else if (that.picDragging == true) {
            that.picDragging = false;
        }
    }

    // 拖拽图形
    let dragGraph = function(e) {
        // 取得鼠标位置
        let scroolTop = $(window).scrollTop();
        let scroolLeft = $(window).scrollLeft();
        that.canvasTop = $(that.canvas_bg).offset().top - scroolTop;
        that.canvasLeft = $(that.canvas_bg).offset().left - scroolLeft;

        let x = e.clientX   - that.canvasLeft;
        let y = e.clientY  - that.canvasTop;

        // 移动的距离
        let dragX = x - clickX;
        let dragY = y - clickY;

        // 判断图形是否开始拖拽
        if (that.isDragging == true) {
            // 判断拖拽对象是否存在
            if (that.previousSelectedGraph != null) {

                let currentDeg = that.previousSelectedGraph.currentDeg;

                let startP = that.rotatePoint({X: clickX - that.options.midpoint.canvasX,Y: clickY - that.options.midpoint.canvasY},-(that.deg-currentDeg)*Math.PI/180);
                let endP = that.rotatePoint({X: x - that.options.midpoint.canvasX,Y: y - that.options.midpoint.canvasY},-(that.deg-currentDeg)*Math.PI/180);
                // 移动的距离
                dragX = endP.X - startP.X;
                dragY = endP.Y - startP.Y;

                // 更新图形的坐标位置
                let pointList = that.previousSelectedGraph.pointList;
                for (let index=0;index<pointList.length;index++) {
                    pointList[index].canvasX += dragX;
                    pointList[index].canvasY += dragY;
                }
                // 如果包含要擦除的图形
                if (that.previousSelectedGraph.compositeType
                    && that.previousSelectedGraph.compositeType == "erasure") {
                    for (let i=0;i<that.previousSelectedGraph.childGraphs.length;i++) {
                        let currentPointList = that.previousSelectedGraph.childGraphs[i].pointList;
                        for (let index=0;index<currentPointList.length;index++) {
                            currentPointList[index].canvasX += dragX;
                            currentPointList[index].canvasY += dragY;
                        }
                    }
                }

                // 更新显示
                that.clearContext("content",that.previousSelectedGraph.coverageId);
                that.drawGraph(that.previousSelectedGraph);
            }
            // 判断图像是否开始拖拽
        } else if (that.picDragging == true) {
            // 更新图形的canvas坐标
            for (let i = 0;i<that.graphList.length;i++) {
                let pointList = that.graphList[i].pointList;
                for (let index=0;index<pointList.length;index++) {
                    pointList[index].canvasX += dragX;
                    pointList[index].canvasY += dragY;
                }
                // 如果包含要擦除的图形
                if (that.graphList[i].compositeType
                    && that.graphList[i].compositeType == "erasure") {
                    for (let j=0;j<that.graphList[i].childGraphs.length;j++) {
                        let currentPointList = that.graphList[i].childGraphs[j].pointList;
                        for (let index=0;index<currentPointList.length;index++) {
                            currentPointList[index].canvasX += dragX;
                            currentPointList[index].canvasY += dragY;
                        }
                    }
                }

            }
            // 更新中点的canvas坐标
            that.options.midpoint.canvasX += dragX;
            that.options.midpoint.canvasY += dragY;
            // 更新焦点的canvas坐标
            that.options.focalPoint.canvasX += dragX;
            that.options.focalPoint.canvasY += dragY;
            // 更新显示
            that.drawGraphs(that.graphList);
        }
        clickX = x;
        clickY = y;
    };

    // 移除蒙版的事件处理程序。
    $(that.canvas_bak).unbind();
    // 绑定鼠标事件
    $(that.canvas_bak).bind('mousedown',canvasClick);
    $(that.canvas_bak).bind('mousemove',dragGraph);
    $(that.canvas_bak).bind('mouseup',stopDragging);
    $(that.canvas_bak).bind('mouseout',stopDragging);
}

// 选中图形
function selected(currentGraph,isDragging) {
    // 改变鼠标样式
    //this.changeCursor("move");
    // 清除之前选择的图形
    if (this.previousSelectedGraph != null) {
        this.previousSelectedGraph.isSelected = false;
        // 更新显示
        this.clearContext("content",this.previousSelectedGraph.coverageId);
        this.drawGraph(this.previousSelectedGraph);
    }
    this.previousSelectedGraph = currentGraph;
    // 选择新图形
    currentGraph.isSelected = true;
    // 使图形允许拖拽
    if(isDragging!=null||isDragging!=undefined){
        this.isDragging = isDragging;
    }else{
        this.isDragging = true;
    }

    // 更新显示
    this.clearContext("content",currentGraph.coverageId);
    this.drawGraph(currentGraph);
    /*// 发送消息，将选中的图形数据发送给外部函数
    this.publishSubscribeService.publish("afterSelectGraph",currentGraph);*/
}

// 根据ROI的ID选中ROI
function selectGraphById(id){
    var selectedGraph=null;
    for(var i=0;i<graphList.length;i++){
        if(graphList[i].id == id){
            selectedGraph = graphList[i];
            break;
        }
    }
    // 选中图形
    selected(selectedGraph,false);
}

// 删除选中图形
function deleteGraph() {
    let that = this;
    // 是否选中图形
    if (that.previousSelectedGraph == null) {
        alert("未选中任何图形");
    } else {
        // 删除对应的canvas
        $("#canvas_"+that.previousSelectedGraph.coverageId).remove();

        // 选中图形的索引
        let index = that.graphList.indexOf(that.previousSelectedGraph);
        // 从图形集合中删除当前图形
        that.graphList.splice(index,1);
        that.previousSelectedGraph = null;

        /*// 发送消息，将删除的图形数据发送给外部函数
        that.publishSubscribeService.publish("afterDeleteGraph",that.previousSelectedGraph);*/
    }
}

// 缩放
function zoomPic(zoom) {
    let that = this;
    $(that.canvas_bak).unbind();
    // 改变鼠标样式
    that.changeCursor("not-allowed");
    if (that.img != null) {
        // 放大
        if (zoom =="zoom-in") {
            that.options.scale += 0.05;
            // 缩小
        } else if (zoom =="zoom-out") {
            that.options.scale -= 0.05;
            if (that.options.scale<=0){
                that.options.scale += 0.05;
            }
            // 适应高度
        } else if (zoom =="height") {
            that.options.scale = 1;
            that.options.iw = that.canvasHeight*(that.img.width/that.img.height);
            that.options.ih = that.canvasHeight;
            // 适应宽度
        } else if (zoom =="width") {
            that.options.scale = 1;
            that.options.iw = that.canvasWidth;
            that.options.ih = that.canvasWidth/(that.img.width/that.img.height);
            // 适应窗口
        } else if (zoom =="window") {
            that.options.scale = 1;
            // 图片长宽比
            let ratio = that.img.width / that.img.height;
            // canvas长宽比
            let canvasRatio = that.canvasWidth / that.canvasHeight;
            let iw = (ratio < canvasRatio) ? that.img.width*(that.canvasHeight/that.img.height) : that.canvasWidth;
            let ih = (ratio < canvasRatio) ? that.canvasHeight : that.img.height*(that.canvasWidth/that.img.width);
            that.options.iw = iw;
            that.options.ih = ih;
            // 1:1
        } else if (zoom =="origin") {
            that.options.scale = 1;
            that.options.iw = that.img.width*that.compressRatio;
            that.options.ih = that.img.height*that.compressRatio;
        }

        // 更新缩放比例
        that.options.zoomRatio = that.img.width / (that.options.iw*that.options.scale);

        // 更新图形canvas坐标
        for (let i = 0;i<that.graphList.length;i++) {
            let currentGraph = that.graphList[i];
            let pointList = currentGraph.pointList;
            for (let i=0;i<pointList.length;i++) {
                let canvasPoint = that.getCanvasPoint(that.options.focalPoint,pointList[i].imageX,pointList[i].imageY);
                pointList[i].canvasX = canvasPoint.canvasX;
                pointList[i].canvasY = canvasPoint.canvasY;
            }
            // 如果包含要擦除的图形
            if (currentGraph.compositeType && currentGraph.compositeType == "erasure") {
                for (let i=0;i<currentGraph.childGraphs.length;i++) {
                    let currentPointList = currentGraph.childGraphs[i].pointList;
                    for (let index=0;index<currentPointList.length;index++) {
                        let canvasPoint = that.getCanvasPoint(that.options.focalPoint,currentPointList[index].imageX,currentPointList[index].imageY);
                        currentPointList[index].canvasX = canvasPoint.canvasX;
                        currentPointList[index].canvasY = canvasPoint.canvasY;
                    }
                }
            }
        }
        // 更新中点canvas坐标
        let midPoint = that.getCanvasPoint(that.options.focalPoint,that.options.midpoint.imageX,that.options.midpoint.imageY);
        that.options.midpoint.canvasX = midPoint.canvasX;
        that.options.midpoint.canvasY = midPoint.canvasY;

        // 更新显示
        that.drawGraphs(that.graphList);
    }
}

// 改变鼠标样式
function changeCursor(cursor){
    document.getElementById("canvas_bak").style.cursor=cursor;
}

//清空
function clearContext(type,coverageId){
    if(type == "bak"){
        this.context_bak.clearRect(0,0,this.canvasWidth,this.canvasHeight);
    } else if (type == "bg") {
        this.context_bg.clearRect(0,0,this.canvasWidth,this.canvasHeight);
    } else if (type == "content") {
        this.canvas = document.getElementById("canvas_"+coverageId);
        this.context = this.canvas.getContext('2d');
        this.context.clearRect(0,0,this.canvasWidth,this.canvasHeight);
    } else if (type == "redraw") {
        this.context_bg.clearRect(0,0,this.canvasWidth,this.canvasHeight);
        for(let i=0;i<this.graphList.length;i++) {
            this.canvas = document.getElementById("canvas_"+this.graphList[i].coverageId);
            this.context = this.canvas.getContext('2d');
            this.context.clearRect(0,0,this.canvasWidth,this.canvasHeight);
        }
    } else if (type == "allGraph") {
        // 改变鼠标样式
        this.changeCursor("not-allowed");
        this.context_bak.clearRect(0,0,this.canvasWidth,this.canvasHeight);
        for(let i=0;i<this.graphList.length;i++) {
            $("#canvas_"+this.graphList[i].coverageId).remove();
        }
        this.deg = 0;
        this.graphList = [];
        this.previousSelectedGraph = null;
        this.canvasNum = 2;
    } else if (type == "all") {
        // 改变鼠标样式
        this.changeCursor("not-allowed");
        this.context_bg.clearRect(0,0,this.canvasWidth,this.canvasHeight);
        this.context_bak.clearRect(0,0,this.canvasWidth,this.canvasHeight);
        for(let i=0;i<this.graphList.length;i++) {
            $("#canvas_"+this.graphList[i].coverageId).remove();
        }
        this.img = null;
        this.deg = 0;
        this.graphList = [];
        this.previousSelectedGraph = null;
        this.canvasNum = 2;
    }
}

// 点绕着原点旋转任意角度后的坐标
function rotatePoint(Source,Angle)//Angle为正时逆时针转动, 单位为弧度
{
    var A,R;
    A = Math.atan2(Source.Y,Source.X)//atan2自带坐标系识别, 注意X,Y的顺序
    A += Angle//旋转
    R = Math.sqrt(Source.X * Source.X + Source.Y * Source.Y)//半径
    return {
        X : Math.cos(A) * R,
        Y : Math.sin(A) * R
    }
}

// 绘制矩形
function drawSquare(pointList,ctx,rotatePoint,newPath){
    let startX = pointList[0].canvasX - rotatePoint.rotateX;
    let startY = pointList[0].canvasY - rotatePoint.rotateY;
    let endX = pointList[1].canvasX - rotatePoint.rotateX;
    let endY = pointList[1].canvasY - rotatePoint.rotateY;

    if (newPath) {
        ctx.beginPath();
    }
    ctx.moveTo(startX,startY);
    // 画四条直线
    ctx.lineTo(endX,startY);
    ctx.lineTo(endX,endY);
    ctx.lineTo(startX,endY);
    ctx.lineTo(startX,startY);
    if (newPath) {
        ctx.closePath();
    }
    ctx.stroke();
    ctx.fill();
}

// 绘制多边形
function drawPolygon(pointList,ctx,rotatePoint,newPath,endPoint){
    if (newPath) {
        ctx.beginPath();
    }
    ctx.moveTo(pointList[0].canvasX-rotatePoint.rotateX, pointList[0].canvasY-rotatePoint.rotateY);
    for (let i = 1;i<pointList.length;i++) {
        ctx.lineTo(pointList[i].canvasX-rotatePoint.rotateX, pointList[i].canvasY-rotatePoint.rotateY);
    }
    if (endPoint) {
        ctx.lineTo(endPoint.endX-rotatePoint.rotateX, endPoint.endY-rotatePoint.rotateY);
    }
    if (newPath) {
        ctx.closePath();
    }
    ctx.stroke();
    ctx.fill();
}

// 判断点是否在线上
function isPointOnLine(currentGraph,x,y,rotatePoint) {
    let rotateX = rotatePoint.rotateX;
    let rotateY = rotatePoint.rotateY;

    let startX = currentGraph.pointList[0].canvasX - rotateX;
    let startY = currentGraph.pointList[0].canvasY - rotateY;
    let endX = currentGraph.pointList[1].canvasX - rotateX;
    let endY = currentGraph.pointList[1].canvasY - rotateY;

    this.context_bak.save();
    this.context_bak.translate(rotateX,rotateY);
    this.context_bak.rotate((this.deg-currentGraph.currentDeg)*Math.PI/180);

    this.context_bak.beginPath();
    this.context_bak.lineWidth = 10;
    this.context_bak.moveTo(startX, startY);
    this.context_bak.lineTo(endX,endY);
    this.context_bak.closePath();

    let flag = this.context_bak.isPointInStroke(x,y);
    this.context_bak.restore();
    return flag;
}

// 判断点是否在矩形内
function isPointInRect(currentGraph,x,y,rotatePoint) {
    let rotateX = rotatePoint.rotateX;
    let rotateY = rotatePoint.rotateY;

    let startX = currentGraph.pointList[0].canvasX - rotateX;
    let startY = currentGraph.pointList[0].canvasY - rotateY;
    let endX = currentGraph.pointList[1].canvasX - rotateX;
    let endY = currentGraph.pointList[1].canvasY - rotateY;

    this.context_bak.save();
    this.context_bak.translate(rotateX,rotateY);
    this.context_bak.rotate((this.deg-currentGraph.currentDeg)*Math.PI/180);

    this.context_bak.beginPath();
    this.context_bak.moveTo(startX, startY);
    this.context_bak.lineTo(endX,startY);
    this.context_bak.lineTo(endX,endY);
    this.context_bak.lineTo(startX,endY);
    this.context_bak.lineTo(startX,startY);
    this.context_bak.closePath();
    let flag = this.context_bak.isPointInPath(x,y);
    this.context_bak.restore();
    return flag;
}

// 判断点是否在圆角矩形内
function isPointInRoundRect(currentGraph,r,clickX,clickY,rotatePoint) {
    let rotateX = rotatePoint.rotateX;
    let rotateY = rotatePoint.rotateY;

    let startX = currentGraph.pointList[0].canvasX - rotateX;
    let startY = currentGraph.pointList[0].canvasY - rotateY;
    let endX = currentGraph.pointList[1].canvasX - rotateX;
    let endY = currentGraph.pointList[1].canvasY - rotateY;

    let w = Math.abs(endX-startX);
    let h = Math.abs(endY-startY);

    if (w < 2 * r) {
        r = w / 2;
    }
    if (h < 2 * r) {
        r = h / 2;
    }

    let x = 0;
    let y = 0;
    // 终点在起点的右下
    if (endX > startX && endY > startY) {
        x = startX;
        y = startY;
        // 终点在起点的左上
    } else if (endX < startX && endY < startY) {
        x = endX;
        y = endY;
        // 终点在起点的右上
    } else if (endX > startX && endY < startY) {
        x = startX;
        y = endY;
        // 终点在起点的左下
    } else {
        x = endX;
        y = startY;
    }

    this.context_bak.save();
    this.context_bak.translate(rotateX,rotateY);
    this.context_bak.rotate((this.deg-currentGraph.currentDeg)*Math.PI/180);

    this.context_bak.beginPath();
    this.context_bak.moveTo(x+r,y);
    this.context_bak.arcTo(x+w,y,x+w,y+h,r);
    this.context_bak.arcTo(x+w,y+h,x,y+h,r);
    this.context_bak.arcTo(x,y+h,x,y,r);
    this.context_bak.arcTo(x,y,x+w,y,r);
    this.context_bak.closePath();

    let flag = this.context_bak.isPointInPath(clickX,clickY);
    this.context_bak.restore();
    return flag;
}

// 判断点是否在椭圆内
function isPointInOval(currentGraph,clickX,clickY,rotatePoint) {
    let rotateX = rotatePoint.rotateX;
    let rotateY = rotatePoint.rotateY;

    let startX = currentGraph.pointList[0].canvasX - rotateX;
    let startY = currentGraph.pointList[0].canvasY - rotateY;
    let endX = currentGraph.pointList[1].canvasX - rotateX;
    let endY = currentGraph.pointList[1].canvasY - rotateY;

    this.context_bak.save();
    this.context_bak.translate(rotateX,rotateY);
    this.context_bak.rotate((this.deg-currentGraph.currentDeg)*Math.PI/180);

    let width = Math.abs(endX-startX);
    let height = Math.abs(endY-startY);

    let x = 0,y = 0;
    // 终点在起点的右下
    if (endX > startX && endY > startY) {
        x = this.getMidpoint(startX,endX),y = this.getMidpoint(startY,endY);
        // 终点在起点的左上
    } else if (endX < startX && endY < startY) {
        x = this.getMidpoint(endX,startX),y = this.getMidpoint(endY,startY);
        // 终点在起点的右上
    } else if (endX > startX && endY < startY) {
        x = this.getMidpoint(startX,endX),y = this.getMidpoint(endY,startY);
        // 终点在起点的左下
    } else {
        x = this.getMidpoint(endX,startX),y = this.getMidpoint(startY,endY);
    }

    let k = (width/0.75)/2,
        w = width/2,
        h = height/2;
    this.context_bak.beginPath();
    this.context_bak.moveTo(x, y-h);
    this.context_bak.bezierCurveTo(x+k, y-h, x+k, y+h, x, y+h);
    this.context_bak.bezierCurveTo(x-k, y+h, x-k, y-h, x, y-h);
    this.context_bak.closePath();
    let flag = this.context_bak.isPointInPath(clickX,clickY);
    this.context_bak.restore();
    return flag;
}

// 判断点是否在多边形内
function isPointInPolygon (currentGraph,x,y,rotatePoint) {
    let rotateX = rotatePoint.rotateX;
    let rotateY = rotatePoint.rotateY;

    let pointList = currentGraph.pointList;

    this.context_bak.save();
    this.context_bak.translate(rotateX,rotateY);
    this.context_bak.rotate((this.deg-currentGraph.currentDeg)*Math.PI/180);

    this.context_bak.beginPath();
    this.context_bak.moveTo(pointList[0].canvasX-rotateX, pointList[0].canvasY-rotateY);
    for (let i = 1;i<pointList.length;i++) {
        this.context_bak.lineTo(pointList[i].canvasX-rotateX, pointList[i].canvasY-rotateY);
    }
    this.context_bak.closePath();


    let flag = this.context_bak.isPointInPath(x,y);
    this.context_bak.restore();
    return flag;
}

// 判断点是否在背景位图范围内
function isPointInPic (x,y) {
    let picWidth = this.options.iw * this.options.scale;
    let picHeight = this.options.ih * this.options.scale;
    let rotateX = this.options.midpoint.canvasX;
    let rotateY = this.options.midpoint.canvasY;

    this.context_bak.save();
    this.context_bak.translate(rotateX,rotateY);
    this.context_bak.rotate(this.deg*Math.PI/180);

    this.context_bak.beginPath();
    this.context_bak.moveTo(-picWidth/2,-picHeight/2);
    this.context_bak.lineTo(picWidth/2,-picHeight/2);
    this.context_bak.lineTo(picWidth/2,picHeight/2);
    this.context_bak.lineTo(-picWidth/2,picHeight/2);
    this.context_bak.lineTo(-picWidth/2,-picHeight/2);
    this.context_bak.closePath();
    let flag = this.context_bak.isPointInPath(x,y);

    this.context_bak.restore();

    return flag;
}

// 根据参照点得到画布坐标相对于图像的坐标
function getImagePoint (referencePoint,x,y) {
    return {
        imageX : referencePoint.imageX + (x-referencePoint.canvasX) * this.options.zoomRatio,
        imageY : referencePoint.imageY + (y-referencePoint.canvasY) * this.options.zoomRatio
    };
}

// 根据参照点得到图像坐标相对于画布的坐标
function getCanvasPoint (referencePoint,imageX,imageY) {
    return {
        canvasX : (imageX - referencePoint.imageX)/(this.options.zoomRatio) + referencePoint.canvasX,
        canvasY : (imageY - referencePoint.imageY)/(this.options.zoomRatio) + referencePoint.canvasY
    }
}