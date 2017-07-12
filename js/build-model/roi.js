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
var strokeSize = 3;
var strokeColor = '#32CD32';
// 选中图形的轮廓样式
var style = {
    strokeColor:"#808080",
    strokeSize:2,
    fillStyle:"rgba(255,255,255,0)"
};

// 绘制的图形的集合
var graphList;

// 选中的图形
var previousSelectedGraph = null;
// 图形是否被选中
var graphSelected = false;

// 当前选中图形的顶点
var selectedPeakPoints;

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

// 压缩的画布，用于最终显示
var offscreenCanvas;
var offscreenContext;
// RGB备份用画布
var rgbBackupCanvas;
var rgbBackupContext;

// 图形索引，用作图形id
var graphIndex = 0;

// 原始图像像素信息
var originImageData = null;

$(document).ready(function(){
    // 初始化画布
    initCanvas();
    // 设置画布大小
    setCanvasSize();
    // 鼠标滚轮事件
    $(canvas_bak).bind('mousewheel DOMMouseScroll',mouseWheel);
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

// 初始化offscreen
function initOffScreen(imgInfoList,callback){
    var startTime = new Date().getTime();
    // 显示加载模态框
    $("#canvasLoadingModal").modal("show");

    for(var i=0;i<imgInfoList.length;i++){
        imgInfoList[i].img = new Image();
        imgInfoList[i].img.src = imgInfoList[i].src;
    }

    var offscreenWidth = 0;
    var offscreenHeight = 0;
    var loadedCount = 0;
    for(var i=0;i<imgInfoList.length;i++){
        var script = 'var img'+i+' = imgInfoList[i].img;' +
            'img'+i+'.onload = function(){' +
            'loadedCount++;' +
            'offscreenWidth+=img'+i+'.width;' +
            'offscreenHeight=img'+i+'.height;' +
            'img'+i+'=null;};';
        eval(script);
    }

    var loadInterval = setInterval(function(){
        if(loadedCount == imgInfoList.length){
            clearInterval(loadInterval);
            offscreenContext.clearRect(0,0,offscreenCanvas.width,offscreenCanvas.height);
            offscreenCanvas.width = offscreenWidth;
            offscreenCanvas.height = offscreenHeight;

            var drawX=0;
            var drawY=0;
            for(var i=0;i<imgInfoList.length;i++){
                offscreenContext.drawImage(imgInfoList[i].img,drawX,drawY,imgInfoList[i].img.width,imgInfoList[i].img.height);
                drawX+=imgInfoList[i].img.width;
                imgInfoList[i].img = null;
            }
            callback();

            var endTime = new Date().getTime();
            console.log("image load time",(endTime - startTime)/1000);
            // 隐藏加载模态框
            $("#canvasLoadingModal").modal("hide");
        }
    },50);
}

// 初期显示图像
function initPic (imgInfoList) {
    // 清空图形和ROI
    clearContext("all",null);

    initOffScreen(imgInfoList,drawOffScreen);

    function drawOffScreen(){
        // 图片长宽比
        var ratio = offscreenCanvas.width / offscreenCanvas.height;
        // canvas长宽比
        var canvasRatio = canvasWidth / canvasHeight;
        // 绘制的宽度和高度
        var iw = (ratio < canvasRatio) ? offscreenCanvas.width*(canvasHeight/offscreenCanvas.height) : canvasWidth;
        var ih = (ratio < canvasRatio) ? canvasHeight : offscreenCanvas.height*(canvasWidth/offscreenCanvas.width);

        // 初期化绘图参数
        options = new Object();
        options.iw = iw;
        options.ih = ih;
        options.ratio = ratio;
        options.canvasRatio = canvasRatio;
        options.scale = 1;
        // 原图与显示图的缩放比例
        options.zoomRatio = offscreenCanvas.width / (iw * options.scale);
        // 中点
        options.midpoint = {
            canvasX : canvasWidth/2,
            canvasY : canvasHeight/2,
            imageX : offscreenCanvas.width/2,
            imageY : offscreenCanvas.height/2
        };
        // 焦点
        options.focalPoint = {
            canvasX : canvasWidth/2,
            canvasY : canvasHeight/2,
            imageX : offscreenCanvas.width/2,
            imageY : offscreenCanvas.height/2
        };

        // 绘制背景图片
        paintPic(options);
    }
}

// 绘制位图
function paintPic (options) {
    let scale = options.scale;
    let iw = options.iw;
    let ih = options.ih;

    // 设置x,y坐标，以焦点缩放
    let canvasX = this.options.focalPoint.canvasX;
    let canvasY = this.options.focalPoint.canvasY;
    let imageX = this.options.focalPoint.imageX;
    let imageY = this.options.focalPoint.imageY;

    let x = canvasX - iw*scale*(imageX/offscreenCanvas.width);
    let y = canvasY - ih*scale*(imageY/offscreenCanvas.height);

    this.context_bg.save();
    // 位移：将图像中点设为canvas原点
    this.context_bg.translate(this.options.midpoint.canvasX,this.options.midpoint.canvasY);
    // 旋转
    this.context_bg.rotate(this.deg*Math.PI/180);
    this.context_bg.drawImage(this.offscreenCanvas, x - this.options.midpoint.canvasX, y - this.options.midpoint.canvasY, iw*scale, ih*scale);
    //this.context_bg.drawImage(this.img, x - this.options.midpoint.canvasX, y - this.options.midpoint.canvasY, iw*scale, ih*scale);
    this.context_bg.restore();
}

// 彩色转灰度
function imageConvertToGray(){
    var imageData = getImageDataForRGB();
    var dataLength = imageData.data.length;
    for (var i = 0; i < dataLength; i += 4) {
        var red = imageData.data[i];
        var green = imageData.data[i + 1];
        var blue = imageData.data[i + 2];
        var gray = parseInt((red + green + blue) / 3);
        imageData.data[i] = gray;
        imageData.data[i + 1] = gray;
        imageData.data[i + 2] = gray;
    }
    offscreenContext.putImageData(imageData, 0, 0);
    paintPic(options);
}

// 彩色转R通道
function imageConvertToR(){
    var imageData = getImageDataForRGB();
    var dataLength = imageData.data.length;
    for (var i = 0; i < dataLength; i += 4) {
        // green
        imageData.data[i + 1] = 0;
        // blue
        imageData.data[i + 2] = 0;
    }
    offscreenContext.putImageData(imageData, 0, 0);
    clearContext("bg");
    paintPic(options);
}

// 彩色转G通道
function imageConvertToG(){
    var imageData = getImageDataForRGB();
    var dataLength = imageData.data.length;
    for (var i = 0; i < dataLength; i += 4) {
        // red
        imageData.data[i] = 0;
        // blue
        imageData.data[i + 2] = 0;
    }
    offscreenContext.putImageData(imageData, 0, 0);
    clearContext("bg");
    paintPic(options);

}

// 彩色转B通道
function imageConvertToB(){
    var imageData = getImageDataForRGB();
    var dataLength = imageData.data.length;
    for (var i = 0; i < dataLength; i += 4) {
        // red
        imageData.data[i] = 0;
        // green
        imageData.data[i + 1] = 0;
    }
    offscreenContext.putImageData(imageData, 0, 0);
    clearContext("bg");
    paintPic(options);

}

// 获取图像imageData
function getImageDataForRGB(){
    var imageData = null;
    if(rgbBackupContext){
        imageData = rgbBackupContext.getImageData(0,0,rgbBackupCanvas.width,rgbBackupCanvas.height);
    }else{
        imageData = offscreenContext.getImageData(0,0,offscreenCanvas.width,offscreenCanvas.height);

        rgbBackupCanvas = document.getElementById("canvas_rgb_backup");
        rgbBackupCanvas.width = offscreenCanvas.width;
        rgbBackupCanvas.height = offscreenCanvas.height;
        rgbBackupContext = rgbBackupCanvas.getContext('2d');
        rgbBackupContext.putImageData(imageData, 0, 0);
    }
    return imageData;
}

// 还原彩色RGB混合通道
function revertRGB(){
    if(rgbBackupContext){
        var imageData = rgbBackupContext.getImageData(0,0,rgbBackupCanvas.width,rgbBackupCanvas.height);
        offscreenContext.putImageData(imageData, 0, 0);
        paintPic(options);
        rgbBackupCanvas = null;
        rgbBackupContext = null;
    }
}

// 鼠标绘制图形:continuous是否画完一个图形后可以继续绘制另一个图形
function mouseDraft(msg,graphType,continuous){
    let that = this;

    let startX;
    let startY;
    let canDraw = false;

    /*// 绘制前必须先加载位图
    if (that.img == null) {
        alert("请先选择图片！");
        return;
    }*/
    // 当是擦除或者扩充时，必须先选中ROI
    if (msg=="eraseROI"||msg=="combineROI") {
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

            that.context_bak.strokeStyle= that.strokeColor;
            //that.context_bak.strokeStyle= that.color;
            that.context_bak.lineWidth = that.strokeSize;

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
                that.drawRoundRect(pointList,roundRectRadius,that.context_bak,{rotateX:0,rotateY:0},true);
                // 椭圆
            } else if (graphType =='oval') {
                clearContext("bak",null);
                pointList[1] = {canvasX:endX,canvasY:endY};
                drawOval(pointList,context_bak,{rotateX:0,rotateY:0},true);
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

            // 获得image坐标
            for (var i=0;i<pointList.length;i++) {
                var currentPoint = pointList[i];
                // 获得image坐标
                var imagePoint = getImagePoint(options.midpoint,currentPoint.canvasX,currentPoint.canvasY);
                currentPoint.imageX = imagePoint.imageX;
                currentPoint.imageY = imagePoint.imageY;
            }

            // 新增ROI的情况
            if(msg=="newROI"){
                if (graphType !='polygon') {
                    if (canDraw) {
                        canDraw = false;
                        // 清空蒙版
                        clearContext("bak",null);

                        // 生成参数
                        var graphObject = new Object();

                        // 矩形坐标转多边形坐标
                        if(graphType =='square'){
                            // 矩形点集转多边形点集
                            var tempPointList = squarePointsToPolygonPoints(pointList);

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
                        } else if(graphType =='oval'){
                            // 椭圆坐标转多边形坐标
                            var tempPointList = ovalPointsToPolygonPoints(pointList);

                            graphObject = {
                                id : graphIndex,
                                graphType : "polygon",
                                isSelected : false,
                                pointList : tempPointList,
                                // 当前画图形时背景位图的偏移量
                                currentDeg : deg,
                                // 当前压缩比
                                compressRatio: compressRatio
                            }

                        } else if(graphType =='roundRect'){
                            // 圆角矩形坐标转多边形坐标

                            var tempPointList = roundRectPointsToPolygonPoints(pointList);

                            graphObject = {
                                id : graphIndex,
                                graphType : "polygon",
                                isSelected : false,
                                pointList : tempPointList,
                                // 当前画图形时背景位图的偏移量
                                currentDeg : deg,
                                // 当前压缩比
                                compressRatio: compressRatio
                            }

                        }else {
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

                        if(continuous!=undefined&&!continuous){
                            $(canvas_bak).unbind();
                            // 改变鼠标样式
                            that.changeCursor("not-allowed");
                        }
                    }
                }
            } else if(msg=="combineROI"){ // 结合ROI的情况
                if(graphType !='polygon'){
                    if (canDraw){
                        canDraw = false;
                        // 清空蒙版
                        clearContext("bak",null);

                        if(graphType =='square'){
                            // 矩形点集转多边形点集
                            var tempPointList = squarePointsToPolygonPoints(pointList);
                        }else if(graphType =='oval'){
                            // 椭圆点集转多边形点集
                            var tempPointList = ovalPointsToPolygonPoints(pointList);

                        }else if(graphType =='roundRect'){
                            // 圆角矩形点集转多边形点集
                            var tempPointList = roundRectPointsToPolygonPoints(pointList);
                        }
                        var currentPoints = previousSelectedGraph.pointList;

                        // 获取两图形交点
                        var intersections = getTwoGraphIntersections(currentPoints,tempPointList);

                        var parentConcaveIndex = isConcavePolygon(currentPoints);
                        var childConcaveIndex = isConcavePolygon(tempPointList);

                        var newGraphPoints = [];
                        // 两图形都为凸多边形的情况
                        if(!parentConcaveIndex && !childConcaveIndex){
                            if(!isPointInChild(currentPoints[0],tempPointList)){
                                newGraphPoints  = combinePoints(currentPoints,tempPointList,"parent","child",intersections);
                            }else{
                                newGraphPoints  = combinePoints(tempPointList,currentPoints,"child","parent",intersections);
                            }
                        }else{
                            if(!isPointInChild(currentPoints[0],tempPointList)){
                                newGraphPoints  = combineConcavePoints(currentPoints,tempPointList,"parent","child",intersections,parentConcaveIndex,childConcaveIndex);
                            }else{
                                newGraphPoints  = combineConcavePoints(tempPointList,currentPoints,"child","parent",intersections,parentConcaveIndex,childConcaveIndex);
                            }
                        }

                        // 获得外轮廓中未出现的交点
                        var unOuterIntr = findInstNotInOuter(newGraphPoints,intersections);
                        console.log("unOuterIntr",unOuterIntr);
                        // 构成内轮廓
                        var innerPointsList = commbineInnerPointsList(unOuterIntr,currentPoints,tempPointList);

                        // 清空点集
                        pointList.length = 0;

                        console.log("newGraphPoints",newGraphPoints);
                        previousSelectedGraph.pointList = newGraphPoints;
                        if(innerPointsList.length>0){
                            previousSelectedGraph.innerPoints=innerPointsList;
                        }
                        // 更新显示
                        selected(previousSelectedGraph,false);
                        // 更新buildModel中的数据
                        updateRegionInBuildModel(previousSelectedGraph);
                    }
                }
            }else if(msg=="eraseROI"){ // 擦除ROI的情况
                if(graphType !='polygon'){
                    if (canDraw){
                        canDraw = false;
                        // 清空蒙版
                        clearContext("bak",null);

                        if(graphType =='square'){
                            // 矩形点集转多边形点集
                            var tempPointList = squarePointsToPolygonPoints(pointList);
                        }else if(graphType =='oval'){
                            // 椭圆点集转多边形点集
                            var tempPointList = ovalPointsToPolygonPoints(pointList);

                        }else if(graphType =='roundRect'){
                            // 圆角矩形点集转多边形点集
                            var tempPointList = roundRectPointsToPolygonPoints(pointList);
                        }
                        var currentPoints = previousSelectedGraph.pointList;

                        // 获取两图形交点
                        var intersections = getTwoGraphIntersections(currentPoints,tempPointList);

                        if(intersections.length == 0){
                            if(!isPointInChild(currentPoints[0],tempPointList)){
                                // 内轮廓
                                var innerPoints = tempPointList;
                                if(previousSelectedGraph.innerPoints){
                                    previousSelectedGraph.innerPoints.push(innerPoints);
                                }else{
                                    previousSelectedGraph.innerPoints = [innerPoints];
                                }
                            }
                        }else{
                            var newGraphPoints = [];
                            if(!isPointInChild(currentPoints[0],tempPointList)){
                                newGraphPoints  = erasePoints(currentPoints,tempPointList,intersections);
                            }else{
                                newGraphPoints  = erasePointsRevers(currentPoints,tempPointList,intersections);
                            }

                            console.log("newGraphPoints",newGraphPoints);
                            previousSelectedGraph.pointList = newGraphPoints;
                        }
                        // 清空点集
                        pointList.length = 0;
                        // 更新显示
                        selected(previousSelectedGraph,false);
                        // 更新buildModel中的数据
                        updateRegionInBuildModel(previousSelectedGraph);
                    }
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
        clearContext("bak",null);

        for (var i=0;i<pointList.length;i++) {
            var currentPoint = pointList[i];
            // 获得image坐标
            var imagePoint = getImagePoint(that.options.midpoint,currentPoint.canvasX,currentPoint.canvasY);
            currentPoint.imageX = imagePoint.imageX;
            currentPoint.imageY = imagePoint.imageY;
        }

        var tempPointList = $.extend(true,[],pointList);

        // 新增ROI的情况
        if(msg=="newROI"){
            // 生成参数
            var graphObject = new Object();

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
            changeCursor("not-allowed");
        }else if(msg=="combineROI"){ // 结合ROI的情况
            var currentPoints = previousSelectedGraph.pointList;

            // 获取两图形交点
            var intersections = getTwoGraphIntersections(currentPoints,tempPointList);

            var parentConcaveIndex = isConcavePolygon(currentPoints);
            var childConcaveIndex = isConcavePolygon(tempPointList);

            var newGraphPoints = [];
            // 两图形都为凸多边形的情况
            if(!parentConcaveIndex && !childConcaveIndex){
                if(!isPointInChild(currentPoints[0],tempPointList)){
                    newGraphPoints  = combinePoints(currentPoints,tempPointList,"parent","child",intersections);
                }else{
                    newGraphPoints  = combinePoints(tempPointList,currentPoints,"child","parent",intersections);
                }
            }else{
                if(!isPointInChild(currentPoints[0],tempPointList)){
                    newGraphPoints  = combineConcavePoints(currentPoints,tempPointList,"parent","child",intersections,parentConcaveIndex,childConcaveIndex);
                }else{
                    newGraphPoints  = combineConcavePoints(tempPointList,currentPoints,"child","parent",intersections,parentConcaveIndex,childConcaveIndex);
                }
            }

            // 获得外轮廓中未出现的交点
            var unOuterIntr = findInstNotInOuter(newGraphPoints,intersections);
            console.log("unOuterIntr",unOuterIntr);
            // 构成内轮廓
            var innerPointsList = commbineInnerPointsList(unOuterIntr,currentPoints,tempPointList);

            // 清空点集
            pointList.length = 0;

            console.log("newGraphPoints",newGraphPoints);
            previousSelectedGraph.pointList = newGraphPoints;
            if(innerPointsList.length>0){
                previousSelectedGraph.innerPoints=innerPointsList;
            }
            // 更新显示
            selected(previousSelectedGraph,false);
            // 更新buildModel中的数据
            updateRegionInBuildModel(previousSelectedGraph);
        }else if(msg=="eraseROI"){ // 擦除ROI的情况
            var currentPoints = previousSelectedGraph.pointList;

            // 获取两图形交点
            var intersections = getTwoGraphIntersections(currentPoints,tempPointList);

            if(intersections.length == 0){
                if(!isPointInChild(currentPoints[0],tempPointList)){
                    // 内轮廓
                    var innerPoints = tempPointList;
                    if(previousSelectedGraph.innerPoints){
                        previousSelectedGraph.innerPoints.push(innerPoints);
                    }else{
                        previousSelectedGraph.innerPoints = [innerPoints];
                    }
                }
            }else{
                var newGraphPoints = [];
                if(!isPointInChild(currentPoints[0],tempPointList)){
                    newGraphPoints  = erasePoints(currentPoints,tempPointList,intersections);
                }else{
                    newGraphPoints  = erasePointsRevers(currentPoints,tempPointList,intersections);
                }

                console.log("newGraphPoints",newGraphPoints);
                previousSelectedGraph.pointList = newGraphPoints;
            }
            // 清空点集
            pointList.length = 0;
            // 更新显示
            selected(previousSelectedGraph,false);
            // 更新buildModel中的数据
            updateRegionInBuildModel(previousSelectedGraph);
        }
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

        // 选中当前roi
        selected(graphObject,false);
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
function drawGraph(graphObject,context,fillColor){
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
    if (fillColor) {
        color = fillColor;
    } else {
        color = "144,238,144";
    }
    // 如果选中，改变线条和填充颜色
    if (!context) {
        if (graphObject.isSelected) {
            ctx.fillStyle = 'rgba('+color+',0.7)';
        }else if(fillColor){
            ctx.fillStyle = 'rgba('+color+',0.3)';
        }else {
            ctx.fillStyle = 'rgba('+color+',0)';
        }
    }

    ctx.strokeStyle= strokeColor;
    ctx.lineWidth = strokeSize;

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

    ctx.restore();
    // 内轮廓
    if(graphObject.innerPoints && graphObject.innerPoints.length>0){
        for(var i=0;i<graphObject.innerPoints.length;i++){
            ctx.save();
            ctx.translate(rotatePoint.rotateX,rotatePoint.rotateY);
            drawPolygon(graphObject.innerPoints[i],ctx,rotatePoint,newPath,null);
            ctx.restore();
            if(graphObject.isSelected){
                ctx.save();
                ctx.clip();
                ctx.clearRect(0,0,canvasWidth,canvasHeight);
                ctx.restore();
            }
        }
    }

}

// 绘制图像和复数图形
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

// 绘制图形
function drawRegions(regionList){
    // 绘制图形
    if (regionList) {
        // 获取最大图层id
        maxCoverageId = 0;
        regionList.forEach(function (graph) {
            if(graph.coverageId > maxCoverageId){
                maxCoverageId = graph.coverageId;
            }
        });
        // 遍历所有图形
        for (let i=0;i<regionList.length;i++) {
            let currentGraph = regionList[i];
            // 绘制图形
            drawGraph(currentGraph,null);
        }
    }
}

// 选择事件
function selectGraph() {
    let that = this;
    // 改变鼠标样式
    changeCursor("pointer");
    /*if (that.img == null) {
        alert("请先选择图片！");
        return;
    }*/
    var style = {
        strokeColor:"#808080",
        strokeSize:2,
        fillStyle:"rgba(255,255,255,0)"
    };
    // 点击的点坐标
    let clickX;
    let clickY;
    // 图形resize状态 0:不可resize；1：可以resize；2：resize中；3：resize结束
    var resizeStatus = 0;
    // resize类型，根据点击的图形轮廓顶点而定
    var resizeType = -1;
    // resize前的高度
    var previousHeight;
    // resize前的宽度
    var previousWidth;
    var tempGraph = {};

    // 如果在事件前已选中
    if(previousSelectedGraph){
        graphSelected = true;
        var result = getOuerHW(selectedPeakPoints);
        previousHeight = result.height;
        previousWidth = result.width;
        $.extend(true,tempGraph,previousSelectedGraph);
    }

    // 缩放图形
    function graphScale(pointList,origin,xScale,yScale){
        pointList.forEach(function(point){
            point.canvasX = (point.canvasX-origin.canvasX)*xScale+origin.canvasX;
            point.canvasY = (point.canvasY-origin.canvasY)*yScale+origin.canvasY;
        });
    }

    // 鼠标点击事件
    let canvasClick = function(e){
        // 取得画布上被单击的点
        let scroolTop = $(window).scrollTop();
        let scroolLeft = $(window).scrollLeft();
        that.canvasTop = $(that.canvas_bg).offset().top - scroolTop;
        that.canvasLeft = $(that.canvas_bg).offset().left - scroolLeft;

        clickX = e.clientX   - that.canvasLeft;
        clickY = e.clientY  - that.canvasTop;

        // 更新图形resize状态,鼠标点击后开始进行resize
        if(resizeStatus == 1){
            resizeStatus = 2;
            return;
        }

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

            var flag = false;
            // 直线
            if (currentGraph.graphType == 'line') {
                flag = that.isPointOnLine(currentGraph,clickX,clickY,rotatePoint);
                // 矩形
            } else if (currentGraph.graphType == 'square') {
                flag = that.isPointInRect(currentGraph,clickX,clickY,rotatePoint);
                // 圆角矩形
            } else if (currentGraph.graphType == 'roundRect') {
                flag = that.isPointInRoundRect(currentGraph,that.roundRectRadius,clickX,clickY,rotatePoint);
                // 椭圆
            } else if (currentGraph.graphType == 'oval') {
                flag = that.isPointInOval(currentGraph,clickX,clickY,rotatePoint);
                // 多边形
            } else if (currentGraph.graphType == 'polygon') {
                flag = isPointInPolygon(currentGraph,clickX,clickY,rotatePoint);
            }

            // 选中图形
            if (flag) {
                // 选中图形
                selected(currentGraph,null);
                graphSelected = true;
                // 工位树选中
                selectNode(currentGraph);

                var result = getOuerHW(selectedPeakPoints);
                previousHeight = result.height;
                previousWidth = result.width;
                $.extend(true,tempGraph,currentGraph);
                break;
            }
        }
        // 没有选中任何图形，并且在位图区域内，则选中位图
        if (!isDragging && isPointInPic(clickX,clickY)) {
            // 改变鼠标样式
            changeCursor("move");
            // 清除之前选择的图形
            if (previousSelectedGraph != null) {
                previousSelectedGraph.isSelected = false;
                // 更新显示
                clearContext("content",previousSelectedGraph.coverageId);
                drawGraph(previousSelectedGraph);

                // 清空轮廓
                clearContext("bak",null);
                selectedPeakPoints = null;
            }
            // 选中位图
            /*if (that.img != null) {
             picDragging = true;
             graphSelected = false;
             }*/
            picDragging = true;
            graphSelected = false;
        }
    };

    // 鼠标移动事件
    var mouseMove = function(e){
        // 取得鼠标位置
        var scroolTop = $(window).scrollTop();
        var scroolLeft = $(window).scrollLeft();
        canvasTop = $(that.canvas_bg).offset().top - scroolTop;
        canvasLeft = $(that.canvas_bg).offset().left - scroolLeft;

        var x = e.clientX   - canvasLeft;
        var y = e.clientY  - canvasTop;

        // 移动的距离
        var dragX = x - clickX;
        var dragY = y - clickY;

        if(graphSelected){
            // 图形resize部分----------------------------------------------------------------------
            // 图形resize
            if(resizeStatus == 0 || resizeStatus == 1){
                resizeType = isPointOnPoints(selectedPeakPoints,x,y);
                console.log("isPointOnPoints",resizeType);
                if(resizeType != -1){
                    if(resizeType == 0 || resizeType == 4){
                        changeCursor("se-resize");
                    }else if(resizeType == 2 || resizeType == 6){
                        changeCursor("sw-resize");
                    }else if(resizeType == 1 || resizeType == 5){
                        changeCursor("n-resize");
                    }else if(resizeType == 3 || resizeType == 7){
                        changeCursor("w-resize");
                    }
                    resizeStatus = 1;
                }else{
                    changeCursor("pointer");
                    resizeStatus = 0;
                }
            }

            if(resizeStatus == 2){
                // 清空蒙版
                clearContext("bak",null);

                // 更新轮廓顶点的坐标位置
                if(resizeType == 0 || resizeType == 4 || resizeType == 2 || resizeType == 6){
                    selectedPeakPoints[resizeType].canvasX = x;
                    selectedPeakPoints[resizeType].canvasY = y;

                    // 绘制图形
                    if(resizeType-4<0){
                        drawSquare([selectedPeakPoints[resizeType],selectedPeakPoints[resizeType+4]],context_bak,{rotateX:0,rotateY:0},true,style);
                    }else{
                        drawSquare([selectedPeakPoints[resizeType-4],selectedPeakPoints[resizeType]],context_bak,{rotateX:0,rotateY:0},true,style);
                    }

                }else{
                    if(resizeType == 1){
                        selectedPeakPoints[0].canvasY = y;
                    }else if(resizeType == 5){
                        selectedPeakPoints[4].canvasY = y;
                    }else if(resizeType == 3){
                        selectedPeakPoints[4].canvasX = x;
                    }else if(resizeType == 7){
                        selectedPeakPoints[0].canvasX = x;
                    }
                    drawSquare([selectedPeakPoints[0],selectedPeakPoints[4]],context_bak,{rotateX:0,rotateY:0},true,style);
                }

                // 更新轮廓顶点坐标
                if(resizeType == 0 || resizeType == 4 || resizeType == 1 || resizeType == 5 || resizeType == 3 || resizeType == 7){
                    selectedPeakPoints[1].canvasX = (selectedPeakPoints[0].canvasX+selectedPeakPoints[4].canvasX)/2;
                    selectedPeakPoints[1].canvasY = selectedPeakPoints[0].canvasY;

                    selectedPeakPoints[2].canvasX = selectedPeakPoints[4].canvasX;
                    selectedPeakPoints[2].canvasY = selectedPeakPoints[0].canvasY;

                    selectedPeakPoints[3].canvasX = selectedPeakPoints[4].canvasX;
                    selectedPeakPoints[3].canvasY = (selectedPeakPoints[0].canvasY+selectedPeakPoints[4].canvasY)/2;

                    selectedPeakPoints[5].canvasX = (selectedPeakPoints[0].canvasX+selectedPeakPoints[4].canvasX)/2;
                    selectedPeakPoints[5].canvasY = selectedPeakPoints[4].canvasY;

                    selectedPeakPoints[6].canvasX = selectedPeakPoints[0].canvasX;
                    selectedPeakPoints[6].canvasY = selectedPeakPoints[4].canvasY;

                    selectedPeakPoints[7].canvasX = selectedPeakPoints[0].canvasX;
                    selectedPeakPoints[7].canvasY = (selectedPeakPoints[0].canvasY+selectedPeakPoints[4].canvasY)/2;
                } else if(resizeType == 2 || resizeType == 6){

                    selectedPeakPoints[0].canvasX = selectedPeakPoints[6].canvasX;
                    selectedPeakPoints[0].canvasY = selectedPeakPoints[2].canvasY;

                    selectedPeakPoints[1].canvasX = (selectedPeakPoints[2].canvasX+selectedPeakPoints[6].canvasX)/2;
                    selectedPeakPoints[1].canvasY = selectedPeakPoints[2].canvasY;

                    selectedPeakPoints[3].canvasX = selectedPeakPoints[2].canvasX;
                    selectedPeakPoints[3].canvasY = (selectedPeakPoints[2].canvasY+selectedPeakPoints[6].canvasY)/2;

                    selectedPeakPoints[4].canvasX = selectedPeakPoints[2].canvasX;
                    selectedPeakPoints[4].canvasY = selectedPeakPoints[6].canvasY;

                    selectedPeakPoints[5].canvasX = (selectedPeakPoints[2].canvasX+selectedPeakPoints[6].canvasX)/2;;
                    selectedPeakPoints[5].canvasY = selectedPeakPoints[6].canvasY;

                    selectedPeakPoints[7].canvasX = selectedPeakPoints[6].canvasX;
                    selectedPeakPoints[7].canvasY = (selectedPeakPoints[2].canvasY+selectedPeakPoints[6].canvasY)/2;;
                }

                // 比例
                var result = getOuerHW(selectedPeakPoints);
                var heightRatio = result.height/previousHeight;
                var widthRatio = result.width/previousWidth;
                // 更新图形坐标
                tempGraph = {};
                $.extend(true,tempGraph,previousSelectedGraph);
                var pointList = tempGraph.pointList;
                var borderValue = getBorderValue(pointList);

                var origin;
                if(resizeType==3||resizeType==4||resizeType==5){
                    // 左上角作为原点
                    origin = {canvasX:borderValue.left,canvasY:borderValue.top};
                }else if(resizeType==6||resizeType==7){
                    // 右上角作为原点
                    origin = {canvasX:borderValue.right,canvasY:borderValue.top};
                }else if(resizeType==0||resizeType==1){
                    // 右下角作为原点
                    origin = {canvasX:borderValue.right,canvasY:borderValue.bottom};
                }else if(resizeType==2){
                    // 左下角作为原点
                    origin = {canvasX:borderValue.left,canvasY:borderValue.bottom};
                }
                // 缩放图形
                graphScale(pointList,origin,widthRatio,heightRatio);
                if(tempGraph.innerPoints && tempGraph.innerPoints.length>0){
                    tempGraph.innerPoints.forEach(function(points){
                        graphScale(points,origin,widthRatio,heightRatio);
                    });
                }

                // 更新显示
                clearContext("content",tempGraph.coverageId);
                drawGraph(tempGraph);
            }


            // 图形移动部分----------------------------------------------------------------------
            /*// 移动的距离
            var dragX = x - clickX;
            var dragY = y - clickY;*/

            // 判断图形是否开始拖拽
            if (isDragging == true) {
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
                    // 如果有内轮廓
                    if (previousSelectedGraph.innerPoints && previousSelectedGraph.innerPoints.length>0) {
                        for (var i=0;i<previousSelectedGraph.innerPoints.length;i++) {
                            var inners = previousSelectedGraph.innerPoints[i];
                            for(var j=0;j<inners.length;j++){
                                inners[j].canvasX += dragX;
                                inners[j].canvasY += dragY;
                            }
                        }
                    }

                    // 清空蒙版
                    clearContext("bak",null);
                    // 更新显示
                    clearContext("content",that.previousSelectedGraph.coverageId);
                    drawGraph(that.previousSelectedGraph);
                }
                // 判断图像是否开始拖拽
            } else if (picDragging == true) {
                // 更新图形的canvas坐标
                for (let i = 0;i<that.graphList.length;i++) {
                    let pointList = that.graphList[i].pointList;
                    for (let index=0;index<pointList.length;index++) {
                        pointList[index].canvasX += dragX;
                        pointList[index].canvasY += dragY;
                    }
                    // 如果有内轮廓
                    if (graphList[i].innerPoints && graphList[i].innerPoints.length>0) {
                        for (var index=0;index<graphList[i].innerPoints.length;index++) {
                            var innerPoints=graphList[i].innerPoints[index];
                            for(var j=0;j<innerPoints.length;j++){
                                innerPoints[j].canvasX += dragX;
                                innerPoints[j].canvasY += dragY;
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
        } else {
            // 判断图像是否开始拖拽
            if(picDragging == true){

                // 更新图形的canvas坐标
                for (var i = 0;i<graphList.length;i++) {
                    var pointList = that.graphList[i].pointList;
                    for (var index=0;index<pointList.length;index++) {
                        pointList[index].canvasX += dragX;
                        pointList[index].canvasY += dragY;
                    }
                    // 如果有内轮廓
                    if (graphList[i].innerPoints && graphList[i].innerPoints.length>0) {
                        for (var index=0;index<graphList[i].innerPoints.length;index++) {
                            var innerPoints=graphList[i].innerPoints[index];
                            for(var j=0;j<innerPoints.length;j++){
                                innerPoints[j].canvasX += dragX;
                                innerPoints[j].canvasY += dragY;
                            }
                        }
                    }

                }
                // 更新中点的canvas坐标
                options.midpoint.canvasX += dragX;
                options.midpoint.canvasY += dragY;
                // 更新焦点的canvas坐标
                options.focalPoint.canvasX += dragX;
                options.focalPoint.canvasY += dragY;
                // 更新显示
                drawGraphs(that.graphList);
            }
        }
        clickX = x;
        clickY = y;
    }

    // 抬起鼠标
    let mouseUp = function() {
        // 改变鼠标样式
        changeCursor("pointer");

        // 图形resize部分----------------------------------------------------------------------
        // 更新图形resize状态,结束resize动作
        if(resizeStatus == 2){
            resizeStatus = 0;

            // 更新顶点点集相对于图像(位图)的坐标
            for (var i=0;i<selectedPeakPoints.length;i++) {
                var currentPoint = selectedPeakPoints[i];
                // 获得image坐标
                var imagePoint = getImagePoint(options.midpoint,currentPoint.canvasX,currentPoint.canvasY);
                currentPoint.imageX = imagePoint.imageX;
                currentPoint.imageY = imagePoint.imageY;
            }

            // 绘制顶点
            drawPeak(selectedPeakPoints,5);

            var result = getOuerHW(selectedPeakPoints);
            previousHeight = result.height;
            previousWidth = result.width;
            $.extend(true,previousSelectedGraph,tempGraph);

            // 更新图形的相对于图像(位图)的坐标
            var pointList = previousSelectedGraph.pointList;
            for (var index=0;index<pointList.length;index++) {
                var point = getImagePoint (options.midpoint,pointList[index].canvasX,pointList[index].canvasY);
                pointList[index].imageX = point.imageX;
                pointList[index].imageY = point.imageY;
            }

            // 更新内轮廓
            var innerPointsList = previousSelectedGraph.innerPoints;
            if(innerPointsList){
                for (var index=0;index<innerPointsList.length;index++) {
                    var innerPoints=innerPointsList[index];
                    for(var j=0;j<innerPoints.length;j++){
                        var point = getImagePoint (options.midpoint,innerPoints[j].canvasX,innerPoints[j].canvasY);
                        innerPoints[j].imageX = point.imageX;
                        innerPoints[j].imageY = point.imageY;
                    }
                }
            }

            // 更新buildModel中的数据
            updateRegionInBuildModel(previousSelectedGraph);
        }


        // 图形移动部分----------------------------------------------------------------------
        // 拖动的是图形
        if (that.isDragging == true) {
            // 更新图形的相对于图像(位图)的坐标
            let pointList = that.previousSelectedGraph.pointList;
            for (let index=0;index<pointList.length;index++) {
                let point = that.getImagePoint (that.options.midpoint,pointList[index].canvasX,pointList[index].canvasY);
                pointList[index].imageX = point.imageX;
                pointList[index].imageY = point.imageY;
            }
            // 更新内轮廓
            var innerPointsList = previousSelectedGraph.innerPoints;
            if(innerPointsList){
                for (var index=0;index<innerPointsList.length;index++) {
                    var innerPoints = innerPointsList[index];
                    for(var j=0;j<innerPoints.length;j++){
                        var point = getImagePoint (options.midpoint,innerPoints[j].canvasX,innerPoints[j].canvasY);
                        innerPoints[j].imageX = point.imageX;
                        innerPoints[j].imageY = point.imageY;
                    }
                }
            }

            that.isDragging = false;


            // 缩放用矩形轮廓顶点集合
            selectedPeakPoints = getGraphPeakPoints(previousSelectedGraph.pointList);
            // 更新image坐标
            for (var i=0;i<selectedPeakPoints.length;i++) {
                var currentPoint = selectedPeakPoints[i];
                // 获得image坐标
                var imagePoint = getImagePoint(options.midpoint,currentPoint.canvasX,currentPoint.canvasY);
                currentPoint.imageX = imagePoint.imageX;
                currentPoint.imageY = imagePoint.imageY;
            }
            // 清空蒙版
            clearContext("bak",null);
            // 外框
            drawSquare([selectedPeakPoints[0],selectedPeakPoints[4]],context_bak,{rotateX:0,rotateY:0},true,style);
            // 顶点矩形
            drawPeak(selectedPeakPoints,5);


            // 更新buildModel中的数据
            updateRegionInBuildModel(previousSelectedGraph);

            /*// 发送消息，将拖动后的图形数据发送给外部函数
            that.publishSubscribeService.publish("afterMoveGraph",that.previousSelectedGraph);*/
            // 拖动的是图像
        } else if (that.picDragging == true) {
            that.picDragging = false;
        }
    }

    // 移除蒙版的事件处理程序。
    $(that.canvas_bak).unbind();
    // 绑定鼠标事件
    // 鼠标滚轮事件
    $(canvas_bak).bind('mousewheel DOMMouseScroll',mouseWheel);
    $(that.canvas_bak).bind('mousedown',canvasClick);
    $(that.canvas_bak).bind('mousemove',mouseMove);
    $(that.canvas_bak).bind('mouseup',mouseUp);
    $(that.canvas_bak).bind('mouseout',mouseUp);
}

// 选中图形
function selected(currentGraph,isDragging) {
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


    // 缩放用矩形轮廓顶点集合
    selectedPeakPoints = getGraphPeakPoints(currentGraph.pointList);

    // 清空蒙版
    clearContext("bak",null);
    // 外框
    drawSquare([selectedPeakPoints[0],selectedPeakPoints[4]],context_bak,{rotateX:0,rotateY:0},true,style);
    // 顶点矩形
    drawPeak(selectedPeakPoints,5);

}

// 绘制轮廓顶点
function drawPeak(selectedPeakPoints,length){
    for(var i=0;i<selectedPeakPoints.length;i++){
        var point = selectedPeakPoints[i];
        drawSquare([{canvasX:point.canvasX-length,canvasY:point.canvasY+length},
                {canvasX:point.canvasX+length,canvasY:point.canvasY-length}]
            ,context_bak,{rotateX:0,rotateY:0},true,style);
    }
}

// 获取轮廓宽度，高度
function getOuerHW(selectedPeakPoints){
    return {
        width:selectedPeakPoints[2].canvasX - selectedPeakPoints[0].canvasX,
        height:selectedPeakPoints[6].canvasY - selectedPeakPoints[0].canvasY
    }
}

// 获取图形边界值
function getBorderValue(pointList) {
    var top=pointList[0].canvasY;
    var bottom=pointList[0].canvasY;
    var left=pointList[0].canvasX;
    var right=pointList[0].canvasX;
    pointList.forEach(function(point){
        if(point.canvasX>=right){
            right = point.canvasX;
        }
        if(point.canvasX<=left){
            left = point.canvasX;
        }
        if(point.canvasY>=bottom){
            bottom = point.canvasY;
        }
        if(point.canvasY<=top){
            top = point.canvasY;
        }
    });
    return {
        top:top,
        bottom:bottom,
        left:left,
        right:right
    }
}

// 获取图形顶点集
function getGraphPeakPoints(graphPointList){
    // 遍历点集，获取四个顶点
    var borderValue = getBorderValue(graphPointList);
    var topLeftPoint = {
        canvasX:borderValue.left,
        canvasY:borderValue.top
    };
    var topRightPoint = {
        canvasX:borderValue.right,
        canvasY:borderValue.top
    };
    var bottomLeftPoint = {
        canvasX:borderValue.left,
        canvasY:borderValue.bottom
    };
    var bottomRightPoint = {
        canvasX:borderValue.right,
        canvasY:borderValue.bottom
    };

    // 两顶点中点
    var topMiddlePoint = {
        canvasX:(topLeftPoint.canvasX+topRightPoint.canvasX)/2,
        canvasY:topLeftPoint.canvasY
    }
    var rightMiddlePoint = {
        canvasX:topRightPoint.canvasX,
        canvasY:(topRightPoint.canvasY+bottomRightPoint.canvasY)/2
    }
    var bottomsMiddlePoint = {
        canvasX:(bottomLeftPoint.canvasX+bottomRightPoint.canvasX)/2,
        canvasY:bottomRightPoint.canvasY
    }
    var leftMiddlePoint = {
        canvasX:bottomLeftPoint.canvasX,
        canvasY:(topLeftPoint.canvasY+bottomRightPoint.canvasY)/2
    }

    // 添加到顶点集合中,从左上顶点开始，顺时针排序
    var points = [topLeftPoint,topMiddlePoint,topRightPoint,
        rightMiddlePoint,bottomRightPoint,bottomsMiddlePoint,
        bottomLeftPoint,leftMiddlePoint];

    // 获得image坐标
    for (var i=0;i<points.length;i++) {
        var currentPoint = points[i];
        // 获得image坐标
        var imagePoint = getImagePoint(options.midpoint,currentPoint.canvasX,currentPoint.canvasY);
        currentPoint.imageX = imagePoint.imageX;
        currentPoint.imageY = imagePoint.imageY;
    }

    return points;
}


// 获取鼠标点击的图形
function getClickedGraph(callback) {
    $(canvas_bak).unbind();
    // 改变鼠标样式
    changeCursor("pointer");
    // 点击的图形
    var clickedGraph;

    // 鼠标点击事件
    var canvasClick = function(e){
        // 取得画布上被单击的点
        var scroolTop = $(window).scrollTop();
        var scroolLeft = $(window).scrollLeft();
        canvasTop = $(canvas_bg).offset().top - scroolTop;
        canvasLeft = $(canvas_bg).offset().left - scroolLeft;

        var clickX = e.clientX   - canvasLeft;
        var clickY = e.clientY  - canvasTop;

        // 以中点为旋转点
        var rotatePoint = {
            rotateX:options.midpoint.canvasX,
            rotateY:options.midpoint.canvasY
        };

        // 遍历图形集合,查找被点击的图形
        for (var i = graphList.length - 1; i >= 0; i--) {
            var currentGraph = graphList[i];
            // 矩形
            if (currentGraph.graphType == 'square') {
                var flag = isPointInRect(currentGraph, clickX, clickY, rotatePoint);
                if (flag) {
                    clickedGraph = currentGraph;
                    break;
                }
                // 圆角矩形
            } else if (currentGraph.graphType == 'roundRect') {
                var flag = isPointInRoundRect(currentGraph, that.roundRectRadius, clickX, clickY, rotatePoint);
                if (flag) {
                    clickedGraph = currentGraph;
                    break;
                }
                // 椭圆
            } else if (currentGraph.graphType == 'oval') {
                var flag = isPointInOval(currentGraph, clickX, clickY, rotatePoint);
                if (flag) {
                    clickedGraph = currentGraph;
                    break;
                }
                // 多边形
            } else if (currentGraph.graphType == 'polygon') {
                var flag = isPointInPolygon(currentGraph, clickX, clickY, rotatePoint);
                if (flag) {
                    clickedGraph = currentGraph;
                    break;
                }
            }
        }

    }

    // 当点击画板外部时，中止此事件
    var bodyClick = function (e) {
        var clickTargetId = $(e.target).attr("id");
        if(clickTargetId != "canvas_bak"){
            clearInterval(interval);
            $(canvas_bak).unbind();
            $("body").unbind();
            // 改变鼠标样式
            changeCursor("not-allowed");
        }
    }

    $("body").bind('mousedown',bodyClick);

    $(canvas_bak).bind('click',canvasClick);

    var interval = setInterval(function(){
        console.log("interval");
        if(clickedGraph){
            $(canvas_bak).unbind();
            $("body").unbind();
            clearInterval(interval);
            callback(clickedGraph);
            // 改变鼠标样式
            changeCursor("not-allowed");
        }
    },500);
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

// 根据图形id获取图形
function findGraphById(id){
    for(var i=0;i<graphList.length;i++){
        if(graphList[i].id == id){
            return graphList[i];
        }
    }
}

// 取消图形选中
function unSelectGraph() {
    if (previousSelectedGraph != null) {
        // 清空蒙版
        clearContext("bak",null);
        selectedPeakPoints = null;

        previousSelectedGraph.isSelected = false;
        // 更新显示
        clearContext("content",this.previousSelectedGraph.coverageId);
        drawGraph(previousSelectedGraph);
        previousSelectedGraph = null;
    }
}

// 删除选中图形
function deleteGraph() {
    let that = this;
    // 是否选中图形
    if (that.previousSelectedGraph != null) {
        // 删除对应的canvas
        $("#canvas_"+that.previousSelectedGraph.coverageId).remove();

        // 选中图形的索引
        let index = that.graphList.indexOf(that.previousSelectedGraph);
        // 从图形集合中删除当前图形
        that.graphList.splice(index,1);

        /*// 发送消息，将删除的图形数据发送给外部函数
         that.publishSubscribeService.publish("afterDeleteGraph",that.previousSelectedGraph);*/

        that.previousSelectedGraph = null;
        graphSelected = false;

        // 清空轮廓
        clearContext("bak",null);
        selectedPeakPoints = null;

    }
}

// 根据graphID删除图形
function deleteGraphById(id){
    var targetGraph = "";
    graphList.forEach(function(graph){
        if(graph.id == id){
            targetGraph = graph;
            return;
        }
    });

    // 删除对应的canvas
    $("#canvas_"+ targetGraph.coverageId).remove();

    // 选中图形的索引
    var index = graphList.indexOf(targetGraph);
    // 从图形集合中删除当前图形
    graphList.splice(index,1);
}

// 缩放
function zoomPic(zoom) {
    let that = this;
    /*$(that.canvas_bak).unbind();
    // 改变鼠标样式
    changeCursor("not-allowed");*/
    /*if (that.img == null) {
        return;
    }*/

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
        that.options.iw = that.canvasHeight*(offscreenCanvas.width/offscreenCanvas.height);
        that.options.ih = that.canvasHeight;
        // 适应宽度
    } else if (zoom =="width") {
        that.options.scale = 1;
        that.options.iw = that.canvasWidth;
        that.options.ih = that.canvasWidth/(offscreenCanvas.width/offscreenCanvas.height);
        // 适应窗口
    } else if (zoom =="window") {
        that.options.scale = 1;
        // 图片长宽比
        let ratio = offscreenCanvas.width / offscreenCanvas.height;
        // canvas长宽比
        let canvasRatio = that.canvasWidth / that.canvasHeight;
        let iw = (ratio < canvasRatio) ? offscreenCanvas.width*(that.canvasHeight/offscreenCanvas.height) : that.canvasWidth;
        let ih = (ratio < canvasRatio) ? that.canvasHeight : offscreenCanvas.height*(that.canvasWidth/offscreenCanvas.width);
        that.options.iw = iw;
        that.options.ih = ih;
        // 1:1
    } else if (zoom =="origin") {
        that.options.scale = 1;
        that.options.iw = offscreenCanvas.width*that.compressRatio;
        that.options.ih = offscreenCanvas.height*that.compressRatio;
    }

    // 更新缩放比例
    that.options.zoomRatio = offscreenCanvas.width / (that.options.iw*that.options.scale);

    // 更新图形canvas坐标
    for (let i = 0;i<that.graphList.length;i++) {
        let currentGraph = that.graphList[i];
        let pointList = currentGraph.pointList;
        for (var index=0;index<pointList.length;index++) {
            var canvasPoint = getCanvasPoint(options.focalPoint,pointList[index].imageX,pointList[index].imageY);
            pointList[index].canvasX = canvasPoint.canvasX;
            pointList[index].canvasY = canvasPoint.canvasY;
        }
        // 内轮廓
        var innerPointsList = currentGraph.innerPoints;
        if(innerPointsList){
            for (var index=0;index<innerPointsList.length;index++) {
                var innerPoints = innerPointsList[index];
                for(var j=0;j<innerPoints.length;j++){
                    var canvasPoint = getCanvasPoint(options.focalPoint,innerPoints[j].imageX,innerPoints[j].imageY);
                    innerPoints[j].canvasX = canvasPoint.canvasX;
                    innerPoints[j].canvasY = canvasPoint.canvasY;
                }
            }
        }
    }
    // 更新中点canvas坐标
    let midPoint = that.getCanvasPoint(that.options.focalPoint,that.options.midpoint.imageX,that.options.midpoint.imageY);
    that.options.midpoint.canvasX = midPoint.canvasX;
    that.options.midpoint.canvasY = midPoint.canvasY;

    // 更新顶点集canvas坐标
    if(selectedPeakPoints){
        for (var i=0;i<selectedPeakPoints.length;i++) {
            var canvasPoint = getCanvasPoint(options.focalPoint,selectedPeakPoints[i].imageX,selectedPeakPoints[i].imageY);
            selectedPeakPoints[i].canvasX = canvasPoint.canvasX;
            selectedPeakPoints[i].canvasY = canvasPoint.canvasY;
        }
    }

    // 更新显示
    drawGraphs(that.graphList);

    // 更新顶点轮廓
    if(selectedPeakPoints){
        // 清空蒙版
        clearContext("bak",null);
        // 外框
        drawSquare([selectedPeakPoints[0],selectedPeakPoints[4]],context_bak,{rotateX:0,rotateY:0},true,style);
        // 顶点矩形
        drawPeak(selectedPeakPoints,5);
    }
}

// 鼠标滚轮事件
var mouseWheel = function(e){
    var delta = (e.originalEvent.wheelDelta && (e.originalEvent.wheelDelta > 0 ? "zoom-in" : "zoom-out")) ||
        (e.originalEvent.detail && (e.originalEvent.detail > 0 ? "zoom-out" : "zoom-in"));
    zoomPic(delta);
    selectGraph();
}

// 旋转
function rotate(direction) {
    $(canvas_bak).unbind();
    // 改变鼠标样式
    changeCursor("not-allowed");
    if (direction == "clockwise") {
        deg += 5;
    } else if (direction == "antiClockwise") {
        deg -= 5;
    } else if (direction == "resetRotate") {
        deg = 0;
    }
    // 更新显示
    drawGraphs(graphList);
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

        rgbBackupCanvas = null;
        rgbBackupContext = null;
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
function drawSquare(pointList,ctx,rotatePoint,newPath,style){
    let startX = pointList[0].canvasX - rotatePoint.rotateX;
    let startY = pointList[0].canvasY - rotatePoint.rotateY;
    let endX = pointList[1].canvasX - rotatePoint.rotateX;
    let endY = pointList[1].canvasY - rotatePoint.rotateY;

    // 是否开始新的路径
    if (newPath) {
        ctx.beginPath();
    }
    // 是否自定义绘制样式
    if(style){
        ctx.strokeStyle= style.strokeColor;
        ctx.lineWidth = style.strokeSize;
        ctx.fillStyle = style.fillStyle;
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

// 绘制圆角矩形
function drawRoundRect(pointList,r,ctx,rotatePoint,newPath){
    let startX = pointList[0].canvasX - rotatePoint.rotateX;
    let startY = pointList[0].canvasY - rotatePoint.rotateY;
    let endX = pointList[1].canvasX - rotatePoint.rotateX;
    let endY = pointList[1].canvasY - rotatePoint.rotateY;

    let w = Math.abs(endX-startX);
    let h = Math.abs(endY-startY);
    // 终点在起点的右下
    if (endX > startX && endY > startY) {
        this.declareRoundRect(startX,startY,w,h,r,ctx,newPath);
        // 终点在起点的左上
    } else if (endX < startX && endY < startY) {
        this.declareRoundRect(endX,endY,w,h,r,ctx,newPath);
        // 终点在起点的右上
    } else if (endX > startX && endY < startY) {
        this.declareRoundRect(startX,endY,w,h,r,ctx,newPath);
        // 终点在起点的左下
    } else {
        this.declareRoundRect(endX,startY,w,h,r,ctx,newPath);
    }

    ctx.stroke();
    ctx.fill();
}

// 定义圆角矩形
function declareRoundRect (x,y,w,h,r,ctx,newPath) {
    // 参数：x坐标，y坐标，宽度，高度，圆角半径
    if (w < 2 * r) {
        r = w / 2;
    }
    if (h < 2 * r) {
        r = h / 2;
    }
    if (newPath) {
        ctx.beginPath();
    }
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    if (newPath) {
        ctx.closePath();
    }
}

// 绘制椭圆
function drawOval (pointList,ctx,rotatePoint,newPath) {
    let startX = pointList[0].canvasX - rotatePoint.rotateX;
    let startY = pointList[0].canvasY - rotatePoint.rotateY;
    let endX = pointList[1].canvasX - rotatePoint.rotateX;
    let endY = pointList[1].canvasY - rotatePoint.rotateY;

    let w = Math.abs(endX-startX);
    let h = Math.abs(endY-startY);
    // 终点在起点的右下
    if (endX > startX && endY > startY) {
        this.declareOval(this.getMidpoint(startX,endX), this.getMidpoint(startY,endY), w, h,ctx,newPath);
        // 终点在起点的左上
    } else if (endX < startX && endY < startY) {
        this.declareOval(this.getMidpoint(endX,startX), this.getMidpoint(endY,startY), w, h,ctx,newPath);
        // 终点在起点的右上
    } else if (endX > startX && endY < startY) {
        this.declareOval(this.getMidpoint(startX,endX), this.getMidpoint(endY,startY), w, h,ctx,newPath);
        // 终点在起点的左下
    } else {
        this.declareOval(this.getMidpoint(endX,startX), this.getMidpoint(startY,endY), w, h,ctx,newPath);
    }
    ctx.stroke();
    ctx.fill();
}

// 定义椭圆（使用两条贝赛尔曲线画出椭圆）
function declareOval(x, y, width, height,ctx,newPath){
    // 贝塞尔控制点x=(椭圆宽度/0.75)/2
    var k = (width/0.75)/2,
        w = width/2,
        h = height/2;
    if (newPath) {
        ctx.beginPath();
    }
    ctx.moveTo(x, y-h);
    ctx.bezierCurveTo(x+k, y-h, x+k, y+h, x, y+h);
    ctx.bezierCurveTo(x-k, y+h, x-k, y-h, x, y-h);
    if (newPath) {
        ctx.closePath();
    }
}

function getMidpoint(start,end){
    return start+(end-start)/2;
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

// 判断点是否在目标点集上
function isPointOnPoints (pointList,x,y){
    // 误差值
    var errorValue = 5;
    var result = -1;
    for(var i=0;i<pointList.length;i++){
        var currentPoint = pointList[i];
        if(x>=currentPoint.canvasX-errorValue && x<=currentPoint.canvasX+errorValue
            && y>=currentPoint.canvasY-errorValue && y<=currentPoint.canvasY+errorValue){
            result = i;
            break;
        }
    }
    return result;
}

// 根据参照点得到画布坐标相对于图像的坐标
function getImagePoint (referencePoint,x,y) {
    return {
        imageX : referencePoint.imageX + (x-referencePoint.canvasX) * options.zoomRatio,
        imageY : referencePoint.imageY + (y-referencePoint.canvasY) * options.zoomRatio
    };
}

// 根据参照点得到图像坐标相对于画布的坐标
function getCanvasPoint (referencePoint,imageX,imageY) {
    return {
        canvasX : (imageX - referencePoint.imageX)/(options.zoomRatio) + referencePoint.canvasX,
        canvasY : (imageY - referencePoint.imageY)/(options.zoomRatio) + referencePoint.canvasY
    }
}

// 矩形点集转多边形点集
function squarePointsToPolygonPoints(pointList){
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

    return [point1,point2,point3,point4];
}

// 椭圆坐标转多边形坐标
function ovalPointsToPolygonPoints(pointList){
    var tempPointList = [];
    var startPointX = pointList[0].canvasX ;
    var startPointY = pointList[0].canvasY;
    var endPointX = pointList[1].canvasX;
    var endPointY = pointList[1].canvasY;

    // 长轴长度
    var OA = Math.abs(endPointX-startPointX)/2;
    // 短轴长度
    var OB = Math.abs(endPointY-startPointY)/2;

    // 椭圆圆点
    var O = [getMidpoint(startPointX,endPointX),getMidpoint(startPointY,endPointY)];
    // 循环360度
    for(var i=0;i<=360;i++){
        // 获取当前角度的弧度
        var ii = i*Math.PI/180;
        var canvasX=O[0]+OA*Math.cos(ii);
        var canvasY=O[1]-OB*Math.sin(ii);
        // 获得image坐标
        var imagePoint = getImagePoint(options.midpoint,canvasX,canvasY);
        tempPointList.push({
            canvasX:canvasX,
            canvasY:canvasY,
            imageX:imagePoint.imageX,
            imageY:imagePoint.imageY
        });

    }
    return tempPointList;
}

// 圆角矩形坐标转多边形坐标
function roundRectPointsToPolygonPoints(pointList){
    var tempPointList = [];

    var startPointX = pointList[0].canvasX ;
    var startPointY = pointList[0].canvasY;
    var endPointX = pointList[1].canvasX;
    var endPointY = pointList[1].canvasY;

    // 长轴长度
    var OA = Math.abs(endPointX-startPointX)/2;
    // 短轴长度
    var OB = Math.abs(endPointY-startPointY)/2;
    // 矩形中心点
    var O = [getMidpoint(startPointX,endPointX),getMidpoint(startPointY,endPointY)];

    // 右上角弧度圆心
    var O1 = [O[0]+OA-roundRectRadius,O[1]-OB+roundRectRadius];
    // 左上角弧度圆心
    var O2 = [O[0]-OA+roundRectRadius,O[1]-OB+roundRectRadius];
    // 左下角弧度圆心
    var O3 = [O[0]-OA+roundRectRadius,O[1]+OB-roundRectRadius];
    // 右下角弧度圆心
    var O4 = [O[0]+OA-roundRectRadius,O[1]+OB-roundRectRadius];

    for(var i=0;i<=360;i++){
        // 获取当前角度的弧度
        var ii = i*Math.PI/180;
        // 右上角弧度点集
        if(i<=90){
            var canvasX=O1[0]+roundRectRadius*Math.cos(ii);
            var canvasY=O1[1]-roundRectRadius*Math.sin(ii);
        }
        // 左上角弧度点集
        if(i>90 && i<=180){
            var canvasX=O2[0]+roundRectRadius*Math.cos(ii);
            var canvasY=O2[1]-roundRectRadius*Math.sin(ii);
        }
        // 左下角弧度点集
        if(i>180 && i<=270){
            var canvasX=O3[0]+roundRectRadius*Math.cos(ii);
            var canvasY=O3[1]-roundRectRadius*Math.sin(ii);
        }
        // 右下角弧度点集
        if(i>270 && i<=360){
            var canvasX=O4[0]+roundRectRadius*Math.cos(ii);
            var canvasY=O4[1]-roundRectRadius*Math.sin(ii);
        }
        // 获得image坐标
        var imagePoint = getImagePoint(options.midpoint,canvasX,canvasY);
        tempPointList.push({
            canvasX:canvasX,
            canvasY:canvasY,
            imageX:imagePoint.imageX,
            imageY:imagePoint.imageY
        });
    }
    return tempPointList;
}

// 两线段交点
// 参数 a，b：线段1两端点；c，d：线段2两端点
function segmentsIntr(a, b, c, d){

    // 三角形abc 面积的2倍
    var area_abc = (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);

    // 三角形abd 面积的2倍
    var area_abd = (a.x - d.x) * (b.y - d.y) - (a.y - d.y) * (b.x - d.x);

    // 面积符号相同则两点在线段同侧,不相交 (对点在线段上的情况,本例当作不相交处理);
    if ( area_abc*area_abd>=0 ) {
        return false;
    }

    // 三角形cda 面积的2倍
    var area_cda = (c.x - a.x) * (d.y - a.y) - (c.y - a.y) * (d.x - a.x);
    // 三角形cdb 面积的2倍
    // 注意: 这里有一个小优化.不需要再用公式计算面积,而是通过已知的三个面积加减得出.
    var area_cdb = area_cda + area_abc - area_abd ;
    if (  area_cda * area_cdb >= 0 ) {
        return false;
    }

    //计算交点坐标
    var t = area_cda / ( area_abd- area_abc );
    var dx= t*(b.x - a.x),
        dy= t*(b.y - a.y);
    return { x: a.x + dx , y: a.y + dy };
}

// 获取两图形交点
function getTwoGraphIntersections(parentPoints,childPoints){
    var intersections = [];
    for(var i=0;i<parentPoints.length;i++){
        var a = {
            x:parentPoints[i].canvasX,
            y:parentPoints[i].canvasY,
        };
        var b = {};
        if(i+1==parentPoints.length){
            b = {
                x:parentPoints[0].canvasX,
                y:parentPoints[0].canvasY,
            }
            console.log("线段：",i,0);
        }else{
            b = {
                x:parentPoints[i+1].canvasX,
                y:parentPoints[i+1].canvasY,
            }
            console.log("线段：",i,i+1);
        }

        for(var j=0;j<childPoints.length;j++){
            var c = {
                x:childPoints[j].canvasX,
                y:childPoints[j].canvasY,
            };
            var d = {};
            if(j+1==childPoints.length){
                d = {
                    x:childPoints[0].canvasX,
                    y:childPoints[0].canvasY,
                }
            }else{
                d = {
                    x:childPoints[j+1].canvasX,
                    y:childPoints[j+1].canvasY,
                }
            }

            var intersection = segmentsIntr(a,b,c,d);
            if(intersection){
                // 交点image坐标
                var imagePoint = getImagePoint(options.midpoint,intersection.x,intersection.y);
                // 交点信息
                var intersectionInfo = {
                    intersection:{
                        canvasX:intersection.x,
                        canvasY:intersection.y,
                        imageX:imagePoint.imageX,
                        imageY:imagePoint.imageY
                    },
                    parentIndex:i,
                    childIndex:j
                };
                intersections.push(intersectionInfo);
            }
        }
    }
    console.log("交点：",intersections);
    return intersections;
}

// 以a点为开始端点的线段是否是相交线
function isIntersectionLine(aIndex,type,intersections){
    var result = false;
    var intersectionInfo = [];
    for(var i=0;i<intersections.length;i++){
        if(type=="parent"){
            if(aIndex == intersections[i].parentIndex){
                intersectionInfo.push(intersections[i]);
            }
        }else if(type=="child"){
            if(aIndex == intersections[i].childIndex){
                intersectionInfo.push(intersections[i]);
            }
        }
    }

    // 获取获取距离a最近的交点
    if(intersectionInfo.length>0){
        result = intersectionInfo;
    }
    return result;
}

// 获取获取距离a最近的交点
function getCloestIntersection(a,intersectionInfoList){
    var result;
    // 获取获取距离a最近的交点
    if(intersectionInfoList.length>0){
        if(intersectionInfoList.length == 1){
            result = intersectionInfoList[0];
        }else{
            var distance = getTwoPointDistance(a,intersectionInfoList[0].intersection);
            for(var i=0;i<intersectionInfoList.length;i++){
                if(getTwoPointDistance(a,intersectionInfoList[i].intersection)<=distance){
                    result = intersectionInfoList[i];
                }
            }
        }
    }
    return result;
}

function findNextIntersection(startIndex,startType,startPointsLength,secondIntersectionInfoList){
    var resultIndexList = [];
    var result;
    if(startType=="parent"){
        for(var i=0;i<secondIntersectionInfoList.length;i++){
            if(secondIntersectionInfoList[i].parentIndex+1!=startPointsLength &&
                secondIntersectionInfoList[i].parentIndex>startIndex){
                resultIndexList.push(secondIntersectionInfoList[i].parentIndex);
            }
        }
        if(resultIndexList.length!=0){
            var resultIndex = resultIndexList[0];
            resultIndexList.forEach(function(index){
                if(index<=resultIndex){
                    resultIndex = index;
                }
            });

            for(var i=0;i<secondIntersectionInfoList.length;i++){
                if(secondIntersectionInfoList[i].parentIndex == resultIndex){
                    result = {
                        startIndex:resultIndex,
                        intersection:secondIntersectionInfoList[i].intersection
                    }
                    break;
                }
            }
        }
    }else{
        for(var i=0;i<secondIntersectionInfoList.length;i++){
            if(secondIntersectionInfoList[i].childIndex+1!=startPointsLength &&
                secondIntersectionInfoList[i].childIndex>startIndex){
                resultIndexList.push(secondIntersectionInfoList[i].childIndex);
            }
        }
        if(resultIndexList.length!=0){
            var resultIndex = resultIndexList[0];
            resultIndexList.forEach(function(index){
                if(index<=resultIndex){
                    resultIndex = index;
                }
            });

            for(var i=0;i<secondIntersectionInfoList.length;i++){
                if(secondIntersectionInfoList[i].childIndex == resultIndex){
                    result = {
                        startIndex:resultIndex,
                        intersection:secondIntersectionInfoList[i].intersection
                    }
                    break;
                }
            }
        }
    }
    return result;
}

function findNextIntersectionReverse(startIndex,secondIntersectionInfoList){
    var resultIndexList = [];
    var result;



    for(var i=0;i<secondIntersectionInfoList.length;i++){
        if(startIndex != 0){
            if(secondIntersectionInfoList[i].parentIndex<startIndex){
                resultIndexList.push(secondIntersectionInfoList[i].parentIndex);
            }
        }else{
            resultIndexList.push(secondIntersectionInfoList[i].parentIndex);
        }

    }
    if(resultIndexList.length!=0){
        var resultIndex = resultIndexList[0];
        resultIndexList.forEach(function(index){
            if(index>=resultIndex){
                resultIndex = index;
            }
        });

        for(var i=0;i<secondIntersectionInfoList.length;i++){
            if(secondIntersectionInfoList[i].parentIndex == resultIndex){
                result = {
                    startIndex:resultIndex,
                    intersection:secondIntersectionInfoList[i].intersection
                }
                break;
            }
        }
    }
    return result;
}

// 获得两点间距离
function getTwoPointDistance(a,b){
    return Math.sqrt(Math.pow((a.canvasX - b.canvasX),2) + Math.pow((a.canvasY - b.canvasY),2));
}

// 当前点是否在子图形内
function isPointInChild(point,childPoints){
    // 以中点为旋转点
    var rotatePoint = {
        rotateX:options.midpoint.canvasX,
        rotateY:options.midpoint.canvasY
    };
    return isPointInPolygon({pointList:childPoints},point.canvasX,point.canvasY,rotatePoint);
}

// 结合两图形点集
function combinePoints(startPoints,secondPoints,startType,secondType,intersections){
    // 根据时钟方向判断两图形点集顺序是否一致
    var startPointClockDirection = clockDirection(startPoints);
    var secondPointsClockDirection = clockDirection(secondPoints);
    var reversed;
    if(startPointClockDirection==secondPointsClockDirection){
        reversed = false;
    }else{
        reversed = true;
    }
    console.log("reversed",reversed);

    var combinedPoints = [];
    for(var i=0;i<startPoints.length;){
        var startPoint = startPoints[i];
        var intersectionInfoList = isIntersectionLine(i,startType,intersections);
        if(intersectionInfoList){
            combinedPoints.push(startPoint);
            var intersectionInfo;
            if(intersectionInfoList.length==1){
                intersectionInfo = intersectionInfoList[0];
            }else{
                intersectionInfo = getCloestIntersection(startPoint,intersectionInfoList);
            }

            combinedPoints.push(intersectionInfo.intersection);

            var secondIndex;
            if(startType == "parent"){
                secondIndex = intersectionInfo.childIndex;
            }else{
                secondIndex = intersectionInfo.parentIndex;
            }

            var secondPoint = secondPoints[secondIndex];
            var secondIntersectionInfoList = isIntersectionLine(secondIndex,secondType,intersections);
            var nextIntr = findNextIntersection(i,startType,startPoints.length,secondIntersectionInfoList);
            if(secondIntersectionInfoList.length <= 2 || !nextIntr){
                if(!reversed){
                    if(secondIndex + 1 == secondPoints.length){
                        secondIndex = 0;
                    }else{
                        secondIndex = secondIndex + 1;
                    }

                    combinedPoints.push(secondPoints[secondIndex]);
                    while(true){
                        if(secondIndex+1 == secondPoints.length){
                            secondIndex = 0;
                        }else{
                            secondIndex++;
                        }
                        secondPoint = secondPoints[secondIndex];
                        secondIntersectionInfoList = isIntersectionLine(secondIndex,secondType,intersections);
                        if(secondIntersectionInfoList){
                            combinedPoints.push(secondPoint);
                            var secondIntersectionInfo;
                            if(secondIntersectionInfoList.length==1){
                                secondIntersectionInfo = secondIntersectionInfoList[0];
                            }else{
                                secondIntersectionInfo = getCloestIntersection(secondPoint,secondIntersectionInfoList);
                            }
                            combinedPoints.push(secondIntersectionInfo.intersection);
                            if(startType == "parent"){
                                i = secondIntersectionInfo.parentIndex + 1;
                            }else{
                                i = secondIntersectionInfo.childIndex + 1;
                            }
                            break;
                        }else{
                            combinedPoints.push(secondPoint);
                        }
                    }
                }else{ // 子图形反序
                    combinedPoints.push(secondPoints[secondIndex]);
                    while(true){
                        if(secondIndex == 0){
                            secondIndex = secondPoints.length-1;
                        }else{
                            secondIndex--;
                        }
                        secondPoint = secondPoints[secondIndex];
                        secondIntersectionInfoList = isIntersectionLine(secondIndex,secondType,intersections);
                        if(secondIntersectionInfoList){
                            /*combinedPoints.push(secondPoint);*/
                            var secondIntersectionInfo;
                            if(secondIntersectionInfoList.length==1){
                                secondIntersectionInfo = secondIntersectionInfoList[0];
                            }else{
                                var previousIndex;
                                if(secondIndex+1 == secondPoints.length){
                                    previousIndex = 0;
                                }else{
                                    previousIndex = secondIndex + 1;
                                }
                                secondIntersectionInfo = getCloestIntersection(secondPoints[previousIndex],secondIntersectionInfoList);
                            }
                            combinedPoints.push(secondIntersectionInfo.intersection);
                            if(startType == "parent"){
                                i = secondIntersectionInfo.parentIndex + 1;
                            }else{
                                i = secondIntersectionInfo.childIndex + 1;
                            }
                            break;
                        }else{
                            combinedPoints.push(secondPoint);
                        }
                    }

                }
            }else{
                combinedPoints.push(nextIntr.intersection);
                i=nextIntr.startIndex+1;
            }
        }else{
            combinedPoints.push(startPoint);
            i++;
        }
    }
    return combinedPoints;
}

// 结合两图形点集(有凹多边形的情况)
function combineConcavePoints(startPoints,secondPoints,startType,secondType,intersections,parentConcaveIndex,childConcaveIndex){
    // 根据时钟方向判断两图形点集顺序是否一致
    var startPointClockDirection = clockDirection(startPoints);
    var secondPointsClockDirection = clockDirection(secondPoints);
    var reversed;
    if(startPointClockDirection==secondPointsClockDirection){
        reversed = false;
    }else{
        reversed = true;
    }
    console.log("reversed",reversed);

    var combinedPoints = [];
    for(var i=0;i<startPoints.length;){
        var startPoint = startPoints[i];
        var intersectionInfoList = isIntersectionLine(i,startType,intersections);
        if(intersectionInfoList){
            combinedPoints.push(startPoint);
            var intersectionInfo;
            if(intersectionInfoList.length==1){
                intersectionInfo = intersectionInfoList[0];
            }else{
                intersectionInfo = getCloestIntersection(startPoint,intersectionInfoList);
            }

            combinedPoints.push(intersectionInfo.intersection);

            var secondIndex;
            var toSecondflag;
            if(startType == "parent"){
                if(parentConcaveIndex.indexOf(i)==-1){
                    toSecondflag = true;
                }else{
                    toSecondflag = false;
                }
                secondIndex = intersectionInfo.childIndex;
            }else{
                if(childConcaveIndex.indexOf(i)==-1){
                    toSecondflag = true;
                }else{
                    toSecondflag = false;
                }
                secondIndex = intersectionInfo.parentIndex;
            }

            var secondPoint = secondPoints[secondIndex];
            var secondIntersectionInfoList = isIntersectionLine(secondIndex,secondType,intersections);
            var nextIntr = findNextIntersection(i,startType,startPoints.length,secondIntersectionInfoList);
            /*if(!nextIntr){
                toSecondflag = true;
            }else{
                toSecondflag = false;
            }*/
            if(toSecondflag || !nextIntr){
                if(!reversed){
                    if(secondIndex + 1 == secondPoints.length){
                        secondIndex = 0;
                    }else{
                        secondIndex = secondIndex + 1;
                    }

                    combinedPoints.push(secondPoints[secondIndex]);
                    while(true){
                        if(secondIndex+1 == secondPoints.length){
                            secondIndex = 0;
                        }else{
                            secondIndex++;
                        }
                        secondPoint = secondPoints[secondIndex];
                        secondIntersectionInfoList = isIntersectionLine(secondIndex,secondType,intersections);
                        if(secondIntersectionInfoList){
                            combinedPoints.push(secondPoint);
                            var secondIntersectionInfo;
                            if(secondIntersectionInfoList.length==1){
                                secondIntersectionInfo = secondIntersectionInfoList[0];
                            }else{
                                secondIntersectionInfo = getCloestIntersection(secondPoint,secondIntersectionInfoList);
                            }
                            combinedPoints.push(secondIntersectionInfo.intersection);
                            if(startType == "parent"){
                                i = secondIntersectionInfo.parentIndex + 1;
                            }else{
                                i = secondIntersectionInfo.childIndex + 1;
                            }
                            break;
                        }else{
                            combinedPoints.push(secondPoint);
                        }
                    }
                }else{ // 子图形反序
                    combinedPoints.push(secondPoints[secondIndex]);
                    while(true){
                        if(secondIndex == 0){
                            secondIndex = secondPoints.length-1;
                        }else{
                            secondIndex--;
                        }
                        secondPoint = secondPoints[secondIndex];
                        secondIntersectionInfoList = isIntersectionLine(secondIndex,secondType,intersections);
                        if(secondIntersectionInfoList){
                            /*combinedPoints.push(secondPoint);*/
                            var secondIntersectionInfo;
                            if(secondIntersectionInfoList.length==1){
                                secondIntersectionInfo = secondIntersectionInfoList[0];
                            }else{
                                var previousIndex;
                                if(secondIndex+1 == secondPoints.length){
                                    previousIndex = 0;
                                }else{
                                    previousIndex = secondIndex + 1;
                                }
                                secondIntersectionInfo = getCloestIntersection(secondPoints[previousIndex],secondIntersectionInfoList);
                            }
                            combinedPoints.push(secondIntersectionInfo.intersection);
                            if(startType == "parent"){
                                i = secondIntersectionInfo.parentIndex + 1;
                            }else{
                                i = secondIntersectionInfo.childIndex + 1;
                            }
                            break;
                        }else{
                            combinedPoints.push(secondPoint);
                        }
                    }

                }
            }else{
                combinedPoints.push(nextIntr.intersection);
                i=nextIntr.startIndex+1;
            }
        }else{
            combinedPoints.push(startPoint);
            i++;
        }
    }
    return combinedPoints;
}

// 从startPoints中擦除与secondPoints相交的部分
function erasePoints(startPoints,secondPoints,intersections){
    // 根据时钟方向判断两图形点集顺序是否一致
    var startPointClockDirection = clockDirection(startPoints);
    var secondPointsClockDirection = clockDirection(secondPoints);
    var reversed;
    if(startPointClockDirection==secondPointsClockDirection){
        reversed = false;
    }else{
        reversed = true;
    }
    console.log("reversed",reversed);

    var newPoints = [];
    for(var i=0;i<startPoints.length;){
        var startPoint = startPoints[i];
        var intersectionInfoList = isIntersectionLine(i,"parent",intersections);
        if(intersectionInfoList){
            newPoints.push(startPoint);
            var intersectionInfo;
            if(intersectionInfoList.length==1){
                intersectionInfo = intersectionInfoList[0];
            }else{
                intersectionInfo = getCloestIntersection(startPoint,intersectionInfoList);
            }

            newPoints.push(intersectionInfo.intersection);

            var secondIndex;
            secondIndex = intersectionInfo.childIndex;

            var secondPoint = secondPoints[secondIndex];
            var secondIntersectionInfoList = isIntersectionLine(secondIndex,"child",intersections);
            var nextIntr = findNextIntersection(i,"parent",startPoints.length,secondIntersectionInfoList);
            if(secondIntersectionInfoList.length == 1 || !nextIntr){
                if(!reversed){
                    newPoints.push(secondPoint);

                    while(true){
                        if(secondIndex == 0){
                            secondIndex = secondPoints.length - 1;
                        }else{
                            secondIndex = secondIndex - 1;
                        }
                        secondPoint = secondPoints[secondIndex];
                        secondIntersectionInfoList = isIntersectionLine(secondIndex,"child",intersections);
                        if(secondIntersectionInfoList){
                            var secondIntersectionInfo;
                            if(secondIntersectionInfoList.length==1){
                                secondIntersectionInfo = secondIntersectionInfoList[0];
                            }else{
                                secondIntersectionInfo = getCloestIntersection(secondPoint,secondIntersectionInfoList);
                            }
                            newPoints.push(secondIntersectionInfo.intersection);
                            i = secondIntersectionInfo.parentIndex + 1;
                            break;
                        }else{
                            newPoints.push(secondPoint);
                        }
                    }
                }else{ // 子图形反序
                    while(true){
                        if(secondIndex + 1 == secondPoints.length){
                            secondIndex = 0;
                        }else{
                            secondIndex = secondIndex + 1;
                        }
                        secondPoint = secondPoints[secondIndex];
                        secondIntersectionInfoList = isIntersectionLine(secondIndex,"child",intersections);
                        if(secondIntersectionInfoList){
                            var secondIntersectionInfo;
                            if(secondIntersectionInfoList.length==1){
                                secondIntersectionInfo = secondIntersectionInfoList[0];
                            }else{
                                secondIntersectionInfo = getCloestIntersection(secondPoint,secondIntersectionInfoList);
                            }
                            newPoints.push(secondPoint);
                            newPoints.push(secondIntersectionInfo.intersection);
                            i = secondIntersectionInfo.parentIndex + 1;
                            break;
                        }else{
                            newPoints.push(secondPoint);
                        }
                    }

                }
            }else{
                newPoints.push(nextIntr.intersection);
                i=nextIntr.startIndex+1;
            }
        }else{
            newPoints.push(startPoint);
            i++;
        }
    }
    return newPoints;
}

// 从startPoints中擦除与secondPoints相交的部分(startPoints起点在secondPoints内)
function erasePointsRevers(startPoints,secondPoints,intersections){
    // 根据时钟方向判断两图形点集顺序是否一致
    var startPointClockDirection = clockDirection(startPoints);
    var secondPointsClockDirection = clockDirection(secondPoints);
    var reversed;
    if(startPointClockDirection==secondPointsClockDirection){
        reversed = false;
    }else{
        reversed = true;
    }
    console.log("reversed",reversed);


    var newPoints = [];
    var firstIntersectionInfo;
    var intrFlag = false;
    for(var i=0;i<startPoints.length;){
        var intersectionInfoList = isIntersectionLine(i,"parent",intersections);
        if(intersectionInfoList){
            firstIntersectionInfo = intersectionInfoList[0];
            newPoints.push(firstIntersectionInfo.intersection);
            intrFlag = true;
            break;
        }else{
            i++;
        }
    }

    var secondIndex = firstIntersectionInfo.childIndex;
    var secondPoint = secondPoints[secondIndex];
    var secondIntersectionInfoList = isIntersectionLine(secondIndex,"child",intersections);
    var nextIntr = findNextIntersectionReverse(i,secondIntersectionInfoList);

    var startIndex;

    if(secondIntersectionInfoList.length == 1){
        // 同序
        if(!reversed){
            while(true){
                if(secondIndex+1==secondPoints.length){
                    secondIndex = 0;
                }else{
                    secondIndex++;
                }
                var intersectionInfoList = isIntersectionLine(secondIndex,"child",intersections);
                if(!intersectionInfoList){
                    newPoints.push(secondPoints[secondIndex]);
                }else{
                    newPoints.push(secondPoints[secondIndex]);
                    var intersectionInfo = intersectionInfoList[0];
                    newPoints.push(intersectionInfo.intersection);
                    startIndex = intersectionInfo.parentIndex;
                    break;
                }
            }
        } else{ // 子图形异序
            newPoints.push(secondPoints[secondIndex]);
            while(true){
                if(secondIndex == 0){
                    secondIndex = secondPoints.length-1;
                }else{
                    secondIndex--;
                }
                var intersectionInfoList = isIntersectionLine(secondIndex,"child",intersections);
                if(!intersectionInfoList){
                    newPoints.push(secondPoints[secondIndex]);
                }else{
                    var intersectionInfo = intersectionInfoList[0];
                    newPoints.push(intersectionInfo.intersection);
                    startIndex = intersectionInfo.parentIndex;
                    break;
                }
            }
        }

        while(startIndex -1 >= firstIntersectionInfo.parentIndex){
            newPoints.push(startPoints[startIndex]);
            startIndex--;
        }
    }else{
        newPoints.push(nextIntr.intersection);
        startIndex = nextIntr.startIndex;
        newPoints.push(startPoints[startIndex]);
        startIndex = startIndex -1;
        while(startIndex -1 >= firstIntersectionInfo.parentIndex){
            var intersectionInfoList = isIntersectionLine(startIndex,"parent",intersections);
            if(!intersectionInfoList){
                newPoints.push(startPoints[startIndex]);
                startIndex--;
            }else{
                intersectionInfo = intersectionInfoList[0];
                secondIndex = intersectionInfo.childIndex;
                secondPoint = secondPoints[secondIndex];
                secondIntersectionInfoList = isIntersectionLine(secondIndex,"child",intersections);
                nextIntr = findNextIntersectionReverse(startIndex,secondIntersectionInfoList);
                if(secondIntersectionInfoList.length==1){
                    // 同序
                    if(!reversed){
                        while(true){
                            if(secondIndex+1==secondPoints.length){
                                secondIndex = 0;
                            }else{
                                secondIndex++;
                            }
                            var intersectionInfoList = isIntersectionLine(secondIndex,"child",intersections);
                            if(!intersectionInfoList){
                                newPoints.push(secondPoints[secondIndex]);
                            }else{
                                newPoints.push(secondPoints[secondIndex]);
                                var intersectionInfo = intersectionInfoList[0];
                                newPoints.push(intersectionInfo.intersection);
                                startIndex = intersectionInfo.parentIndex;
                                break;
                            }
                        }
                    } else{ // 子图形异序
                        newPoints.push(secondPoints[secondIndex]);
                        while(true){
                            if(secondIndex == 0){
                                secondIndex = secondPoints.length-1;
                            }else{
                                secondIndex--;
                            }
                            var intersectionInfoList = isIntersectionLine(secondIndex,"child",intersections);
                            if(!intersectionInfoList){
                                newPoints.push(secondPoints[secondIndex]);
                            }else{
                                var intersectionInfo = intersectionInfoList[0];
                                newPoints.push(intersectionInfo.intersection);
                                startIndex = intersectionInfo.parentIndex;
                                break;
                            }
                        }
                    }
                }else{
                    newPoints.push(intersectionInfo.intersection);
                    newPoints.push(nextIntr.intersection);
                    startIndex = nextIntr.startIndex;
                    newPoints.push(startPoints[startIndex]);
                    startIndex = startIndex -1;
                }
            }
        }
    }

    return newPoints;
}


// 内轮廓
function commbineInnerPointsList(unOuterIntr,parentPoints,childPoints){
    // 根据时钟方向判断两图形点集顺序是否一致
    var startPointClockDirection = clockDirection(parentPoints);
    var secondPointsClockDirection = clockDirection(childPoints);
    var reversed;
    if(startPointClockDirection==secondPointsClockDirection){
        reversed = false;
    }else{
        reversed = true;
    }

    var innerPointsList=[];
    if(unOuterIntr.length>0){
        for(var i=0;i<unOuterIntr.length;){
            var innerPoints=[];
            var startIntr = unOuterIntr[i];
            var endIntr = unOuterIntr[i+1];

            innerPoints.push(startIntr.intersection);
            var parentPointIndex=startIntr.parentIndex;
            while(parentPointIndex<endIntr.parentIndex){
                if(parentPointIndex+1==parentPoints.length){
                    parentPointIndex=0;
                }else{
                    parentPointIndex++;
                }
                innerPoints.push(parentPoints[parentPointIndex]);
            }

            innerPoints.push(endIntr.intersection);
            var childPointIndex = endIntr.childIndex;
            if(!reversed){
                while(childPointIndex<startIntr.parentIndex){
                    if(childPointIndex+1==childPoints.length){
                        childPointIndex = 0;
                    }else{
                        childPointIndex++;
                    }
                    innerPoints.push(childPoints[childPointIndex]);
                }

                innerPointsList.push(innerPoints);
            }else{
                while(childPointIndex>startIntr.parentIndex){
                    if(childPointIndex==0){
                        childPointIndex = childPoints.length-1;
                    }else{
                        childPointIndex--;
                    }
                    innerPoints.push(childPoints[childPointIndex]);
                }

                innerPointsList.push(innerPoints);
            }

            i+=2;
        }
    }
    return innerPointsList;
}


// 获得外轮廓中未出现的交点
function findInstNotInOuter(outerPoints,intersections){
    var unOuterIntr = [];
    for(var i=0;i<intersections.length;i++){
        var flag=true;
        for(var j=0;j<outerPoints.length;j++){
            if(intersections[i].intersection.canvasX==outerPoints[j].canvasX && intersections[i].intersection.canvasY==outerPoints[j].canvasY){
                flag=false;
                break;
            }
        }
        if(flag){
            unOuterIntr.push(intersections[i]);
        }
    }
    return unOuterIntr;
}

// 判断点point在线段a,b的位置
// Tmp>0在左侧;Tmp=0在线上;Tmp<0在右侧
function pointOfLine(a,b,point){
    var tmp = (a.canvasY - b.canvasY) * point.canvasX + (b.canvasX - a.canvasX) * point.canvasY + a.canvasX * b.canvasY - b.canvasX * a.canvasY;
    if(tmp>0){
        return "left"
    }else if(tmp<0){
        return "right"
    }else{
        return "on";
    }
}

// 判断是否是凹多边形
// 是：返回凹边起点集合；否：false
function isConcavePolygon(points){
    var concaveStartPointsIndex = [];
    for(var i=0;i<points.length;i++){
        var a = points[i];
        var b;
        if(i+1!=points.length){
            b = points[i+1];
        }else{
            b = points[0];
        }

        var compareTmp;
        for(var j=0;j<points.length;j++){
            var tmp = pointOfLine(a,b,points[j]);
            if(tmp!="on"){
                compareTmp = tmp;
                break;
            }
        }

        for(var j=0;j<points.length;j++){
            var tmp = pointOfLine(a,b,points[j]);
            if(tmp!="on" && tmp!=compareTmp){
                concaveStartPointsIndex.push(i);
                break;
            }
        }
    }
    if(concaveStartPointsIndex.length>0){
        return concaveStartPointsIndex;
    }else{
        return false;
    }
}

// 判断多边形时钟方向 <0顺时针，>0逆时针
// 参考http://blog.csdn.net/xxdddail/article/details/48787059
// http://blog.csdn.net/betwater/article/details/52478703
function clockDirection(points)
{
    var i, j, k;
    var count = 0;
    var z;
    var yTrans = -1;
    if (points == null || points.length < 3)
    {
        return false;
    }
    var n = points.length;
    for (i = 0; i < n; i++)
    {
        j = (i + 1) % n;
        k = (i + 2) % n;
        z = (points[j].canvasX - points[i].canvasX) * (points[k].canvasY * yTrans - points[j].canvasY * yTrans);
        z -= (points[j].canvasY * yTrans - points[i].canvasY * yTrans) * (points[k].canvasX - points[j].canvasX);
        if (z < 0)
        {
            count--;
        }
        else if (z > 0)
        {
            count++;
        }
    }
    if(count<0){
        return "clockWise"
    }else if(count>0){
        return "counterClockwise"
    }else{
        return null;
    }
}