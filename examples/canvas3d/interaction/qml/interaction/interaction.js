Qt.include("glMatrix-0.9.5.min.js")
Qt.include("ThreeJSLoader.js")

var gl;

var texturedShaderProgram = 0;
var vertexShader = 0;
var fragmentShader = 0;

var vertexPositionAttribute;
var textureCoordAttribute;
var vertexNormalAttribute;

var pMatrixUniform;
var mvMatrixUniform;
var nMatrixUniform;
var textureSamplerUniform;

var barrelTexture = 0;

var mvMatrix = mat4.create();
var pMatrix  = mat4.create();
var nMatrix  = mat4.create();
var startTime;

var canvas3d;

function log(message) {
    if (canvas3d.logAllCalls)
        console.log(message)
}

function Model() {
    this.verticesVBO = 0;
    this.normalsVBO  = 0;
    this.texCoordVBO = 0;
    this.indexVBO    = 0;
    this.count       = 0;
}

var theModel = new Model();

function initGL(canvas, textureLoader) {
    canvas3d = canvas
    log("*******************************************************************************************")
    log("initGL ENTER...")
    try {
        startTime = Date.now();

        // Get the OpenGL context jsonObj that represents the API we call
        log("Getting Context");
        gl = canvas.getContext("canvas3d", {depth:true, antialias:true});
        log("Context received "+gl);

        var contextConfig = gl.getContextAttributes();
        log("Depth: "+contextConfig.alpha);
        log("Stencil: "+contextConfig.stencil);
        log("Antialiasing: "+contextConfig.antialias);
        log("Premultiplied alpha: "+contextConfig.premultipliedAlpha);
        log("Preserve drawingbuffer: "+contextConfig.preserveDrawingBuffer);
        log("Prefer Low Power To High Performance: "+contextConfig.preferLowPowerToHighPerformance);
        log("Fail If Major Performance Caveat: "+contextConfig.failIfMajorPerformanceCaveat);

        // Setup the OpenGL state
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_WRITE);
        gl.depthMask(true);

        gl.frontFace(gl.CCW);
        gl.cullFace(gl.BACK);

        gl.disable(gl.BLEND);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);

        // Set viewport
        gl.viewport(0, 0,
                    canvas.width * canvas.devicePixelRatio,
                    canvas.height * canvas.devicePixelRatio);

        // Initialize the shader program
        initShaders();

        // Initialize buffers
        theModel.verticesVBO = gl.createBuffer();
        theModel.verticesVBO.name = "BarrelModel.verticesVBO";
        theModel.normalsVBO = gl.createBuffer();
        theModel.normalsVBO.name = "BarrelModel.normalsVBO";
        theModel.texCoordVBO = gl.createBuffer();
        theModel.texCoordVBO.name = "BarrelModel.texCoordVBO";
        theModel.indexVBO = gl.createBuffer();
        theModel.indexVBO.name = "BarrelModel.indexVBO";

        // Load the barrel texture
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        textureLoader.loadImage("qrc:/qml/interaction/barrel.jpg");

        // Load the model
        log("    Create XMLHttpRequest")
        var request = new XMLHttpRequest();
        log("    XMLHttpRequest.open")
        request.open("GET", "barrel.json");
        log("    XMLHttpRequest.onreadystatechange")
        request.onreadystatechange = function () {
            if (request.readyState == XMLHttpRequest.DONE) {
                handleLoadedModel(JSON.parse(request.responseText));
            }
        }
        log("    XMLHttpRequest.send")
        request.send();

        log("...initGL EXIT");
    } catch(e) {
        console.log("...initGL FAILURE!");
        console.log(""+e);
        console.log(""+e.message);
    }
    log("*******************************************************************************************");
}


function renderGL(canvas) {
    // draw
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // draw only when we have the mesh and texture
    if (theModel.count <= 0 || barrelTexture == 0) return;

    gl.useProgram(texturedShaderProgram);

    // Calculate the perspective projection
    mat4.perspective(pMatrix, degToRad(45), canvas.width / canvas.height, 0.1, 10000.0);
    gl.uniformMatrix4fva(pMatrixUniform, false, pMatrix);

    // Bind the correct buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, theModel.verticesVBO);
    gl.enableVertexAttribArray(vertexPositionAttribute);
    gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, theModel.normalsVBO);
    gl.enableVertexAttribArray(vertexNormalAttribute);
    gl.vertexAttribPointer(vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, theModel.texCoordVBO);
    gl.enableVertexAttribArray(textureCoordAttribute);
    gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, barrelTexture);
    gl.uniform1i(textureSamplerUniform, 0);

    // Calculate and apply the modelview matrix
    mvMatrix = mat4.identity(mvMatrix);
    mvMatrix = mat4.translate(mvMatrix, mvMatrix, [0, -40, -700]);
    //! [0]
    mvMatrix = mat4.rotate(mvMatrix, mvMatrix, degToRad(canvas.xRotSlider), [1, 0, 0]);
    mvMatrix = mat4.rotate(mvMatrix, mvMatrix, degToRad(canvas.yRotSlider), [0, 1, 0]);
    mvMatrix = mat4.rotate(mvMatrix, mvMatrix, degToRad(canvas.zRotSlider), [0, 0, 1]);
    //! [0]
    gl.uniformMatrix4fva(mvMatrixUniform, false, mvMatrix);

    // Calculate normal matrix
    nMatrix = mat4.invert(nMatrix, mvMatrix);
    nMatrix = mat4.transpose(nMatrix, nMatrix);
    gl.uniformMatrix4fva(nMatrixUniform, false, nMatrix);

    // Draw the barrel
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, theModel.indexVBO);
    //! [1]
    gl.drawElements(gl.TRIANGLES, theModel.count, gl.UNSIGNED_SHORT, 0);
    //! [1]

    // Calculate and apply the modelview matrix
    mvMatrix = mat4.identity(mvMatrix);
    mvMatrix = mat4.translate(mvMatrix, mvMatrix, [-250, -50, -700]);
    mvMatrix = mat4.rotate(mvMatrix, mvMatrix, degToRad(canvas.xRotSlider), [0, 1, 0]);
    gl.uniformMatrix4fva(mvMatrixUniform, false, mvMatrix);

    // Calculate normal matrix
    nMatrix = mat4.invert(nMatrix, mvMatrix);
    nMatrix = mat4.transpose(nMatrix, nMatrix);
    gl.uniformMatrix4fva(nMatrixUniform, false, nMatrix);

    // Draw the barrel
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, theModel.indexVBO);
    //! [2]
    gl.drawElements(gl.POINTS, theModel.count, gl.UNSIGNED_SHORT, 0);
    //! [2]

    // Calculate and apply the modelview matrix
    mvMatrix = mat4.identity(mvMatrix);
    mvMatrix = mat4.translate(mvMatrix, mvMatrix, [250, -50, -700]);
    mvMatrix = mat4.rotate(mvMatrix, mvMatrix, degToRad(canvas.zRotSlider), [0, 1, 0]);
    gl.uniformMatrix4fva(mvMatrixUniform, false, mvMatrix);

    // Calculate normal matrix
    nMatrix = mat4.invert(nMatrix, mvMatrix);
    nMatrix = mat4.transpose(nMatrix, nMatrix);
    gl.uniformMatrix4fva(nMatrixUniform, false, nMatrix);

    // Draw the barrel
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, theModel.indexVBO);
    //! [3]
    gl.drawElements(gl.LINES, theModel.count, gl.UNSIGNED_SHORT, 0);
    //! [3]
}

function handleLoadedModel(jsonObj) {
    log("*******************************************************************************************");
    log("handleLoadedModel ENTER...")
    var modelData = parseJSON3DModel(jsonObj, "");

    log("    "+theModel.verticesVBO);
    gl.bindBuffer(gl.ARRAY_BUFFER, theModel.verticesVBO);
    gl.bufferData(gl.ARRAY_BUFFER,
                  Arrays.newFloat32Array(modelData.vertices),
                  gl.STATIC_DRAW);

    log("    "+theModel.normalsVBO);
    gl.bindBuffer(gl.ARRAY_BUFFER, theModel.normalsVBO);
    gl.bufferData(gl.ARRAY_BUFFER,
                  Arrays.newFloat32Array(modelData.normals),
                  gl.STATIC_DRAW);

    log("    "+theModel.texCoordVBO);
    gl.bindBuffer(gl.ARRAY_BUFFER, theModel.texCoordVBO);
    gl.bufferData(gl.ARRAY_BUFFER,
                  Arrays.newFloat32Array(modelData.texCoords[0]),
                  gl.STATIC_DRAW);

    log("    "+theModel.indexVBO);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, theModel.indexVBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
                  Arrays.newUint16Array(modelData.indices),
                  gl.STATIC_DRAW);

    theModel.count = modelData.indices.length;
    log("...handleLoadedModel EXIT");
    log("*******************************************************************************************");
}

function textureLoaded(textureImage) {
    log("*******************************************************************************************");
    log("textureLoaded ENTER...")

    if (textureImage.imageState == TextureImage.LOADING_FINISHED && barrelTexture  == 0) {
        log("    processing "+textureImage.source);
        barrelTexture = gl.createTexture();
        barrelTexture.name = "barrelTexture"
        gl.bindTexture(gl.TEXTURE_2D, barrelTexture);
        gl.texImage2D(gl.TEXTURE_2D,    // target
                      0,                // level
                      gl.RGBA,          // internalformat
                      gl.RGBA,          // format
                      gl.UNSIGNED_BYTE, // type
                      textureImage);    // pixels

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.generateMipmap(gl.TEXTURE_2D);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    log("...textureLoaded EXIT");
    log("*******************************************************************************************");
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

function initShaders()
{
    log("    initShaders ENTER...")

    vertexShader = getShader(gl,
                             "attribute highp vec3 aVertexNormal;
                              attribute highp vec3 aVertexPosition;
                              attribute highp vec2 aTextureCoord;

                              uniform highp mat4 uNormalMatrix;
                              uniform mat4 uMVMatrix;
                              uniform mat4 uPMatrix;

                              varying highp vec2 vTextureCoord;
                              varying highp vec3 vLighting;

                              void main(void) {
                                 gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
                                 vTextureCoord = aTextureCoord;
                                 highp vec3 ambientLight = vec3(0.5, 0.5, 0.5);
                                 highp vec3 directionalLightColor = vec3(0.75, 0.75, 0.75);
                                 highp vec3 directionalVector = vec3(0.85, 0.8, 0.75);
                                 highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);

                                 highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
                                 vLighting = ambientLight + (directionalLightColor * directional);
                             }", gl.VERTEX_SHADER);

    fragmentShader = getShader(gl,
                               "varying highp vec2 vTextureCoord;
                                varying highp vec3 vLighting;

                                uniform sampler2D uSampler;

                                void main(void) {
                                    mediump vec4 texelColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
                                    gl_FragColor = vec4(texelColor.rgb * vLighting, 1.0);
                                }", gl.FRAGMENT_SHADER);

    texturedShaderProgram = gl.createProgram();
    texturedShaderProgram.name = "TexturedShaderProgram";
    gl.attachShader(texturedShaderProgram, vertexShader);
    gl.attachShader(texturedShaderProgram, fragmentShader);
    gl.linkProgram(texturedShaderProgram);

    if (!gl.getProgramParameter(texturedShaderProgram, gl.LINK_STATUS)) {
        console.log("Could not initialize shaders");
        console.log(gl.getProgramInfoLog(texturedShaderProgram));
    }

    gl.useProgram(texturedShaderProgram);

    // look up where the vertex data needs to go.
    vertexPositionAttribute = gl.getAttribLocation(texturedShaderProgram, "aVertexPosition");
    vertexPositionAttribute.name = "aVertexPosition_AttribLocation";
    gl.enableVertexAttribArray(vertexPositionAttribute);
    vertexNormalAttribute = gl.getAttribLocation(texturedShaderProgram, "aVertexNormal");
    vertexPositionAttribute.name = "aVertexNormal_AttribLocation";
    gl.enableVertexAttribArray(vertexNormalAttribute);
    textureCoordAttribute = gl.getAttribLocation(texturedShaderProgram, "aTextureCoord");
    vertexPositionAttribute.name = "aTextureCoord_AttribLocation";
    gl.enableVertexAttribArray(textureCoordAttribute);

    pMatrixUniform  = gl.getUniformLocation(texturedShaderProgram, "uPMatrix");
    pMatrixUniform.name = "uPMatrix_UniformLocation";
    mvMatrixUniform = gl.getUniformLocation(texturedShaderProgram, "uMVMatrix");
    mvMatrixUniform.name = "uMVMatrix_UniformLocation";
    textureSamplerUniform = gl.getUniformLocation(texturedShaderProgram, "uSampler")
    textureSamplerUniform.name = "uSampler_UniformLocation";
    nMatrixUniform = gl.getUniformLocation(texturedShaderProgram, "uNormalMatrix");
    nMatrixUniform.name = "uNormalMatrix_UniformLocation";
    log("    ... initShaders EXIT");
}

function getShader(gl, str, type) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log("JS:Shader compile failed");
        console.log(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}
