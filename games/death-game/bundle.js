// TODO: move to other utils
const createObjectPool = (create, reset) => {
    const objects = [];
    return {
        free(obj) {
            if (reset)
                reset(obj);
            objects.push(obj);
        },
        alloc() {
            if (objects.length > 0) {
                return objects.pop();
            }
            return create();
        },
        getSize() {
            return objects.length;
        },
        dispose() {
            objects.length = 0;
        }
    };
};
const canvasPool = createObjectPool(() => document.createElement("canvas"), (canvas) => {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
});
const wrapCanvasFunc = (func, source, ...rest) => {
    const canvas = canvasPool.alloc();
    const dest = func(canvas, canvas.getContext("2d"), source, ...rest);
    canvasPool.free(source);
    return dest;
};
const colorizeImage = (image, color, canvas = canvasPool.alloc(), context = canvas.getContext("2d")) => {
    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);
    context.fillStyle = color;
    context.globalCompositeOperation = "source-in";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
};
const drawRegion = (image, sx, sy, sw, sh, dx = 0, dy = 0, canvas = canvasPool.alloc(), context = canvas.getContext("2d")) => {
    canvas.width = sw;
    canvas.height = sh;
    context.drawImage(image, sx, sy, sw, sh, dx, dy, sw, sh);
    return canvas;
};
const addOutline = (canvas, context = canvas.getContext("2d"), image, size, color) => {
    canvas.width = image.width + size * 2;
    canvas.height = image.height + size * 2;
    const dArr = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1], s = size, x = size, y = size;
    for (let i = 0; i < dArr.length; i += 2)
        context.drawImage(image, x + dArr[i] * s, y + dArr[i + 1] * s);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-over";
    context.drawImage(image, x, y);
    return canvas;
};
const eraseColor = (canvas, context, image, r = 0, g = r, b = r) => {
    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);
    const imgData = context.getImageData(0, 0, canvas.width, canvas.height), rgba = imgData.data;
    for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i] === r && rgba[i + 1] === g && rgba[i + 2] === b) {
            rgba[i + 3] = 0;
        }
    }
    context.putImageData(imgData, 0, 0);
    return canvas;
};
const getOpaqueBounds = (canvas, context = canvas.getContext("2d")) => {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight), rgba = imageData.data;
    let x, y, i;
    let minX = canvasWidth, minY = canvasHeight, maxX = 0, maxY = 0;
    for (y = 0; y < canvasHeight; y++) {
        for (x = 0; x < canvasWidth; x++) {
            i = (x + y * canvasWidth) * 4;
            if (rgba[i] !== 0) {
                if (x < minX)
                    minX = x;
                if (y < minY)
                    minY = y;
                if (x > maxX)
                    maxX = x;
                if (y > maxY)
                    maxY = y;
            }
        }
    }
    return [minX, minY, maxX, maxY];
};
const cropAlpha = (canvas, context, image, [minX, minY, maxX, maxY]) => {
    canvas.width = maxX - minX + 1;
    canvas.height = maxY - minY + 1;
    context.drawImage(image, -minX, -minY);
    return canvas;
};
const scalePixelated = (canvas, context, image, scaleX, scaleY = scaleX) => {
    canvas.width = image.width * scaleX;
    canvas.height = image.height * scaleY;
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
};
const addPadding = (canvas, context, image, border) => {
    canvas.width = image.width + border * 2;
    canvas.height = image.height + border * 2;
    context.drawImage(image, border, border);
    return canvas;
};

const ASSETS_TILE_SIZE = 10;
const ASSETS_TILE_SCALE = 4;
const ASSETS_ITEM_SCALE = 3;
const ASSETS_BORDER_SIZE = 2;
const ASSETS_OUTLINE_SIZE = 2;
const ASSETS_SCALED_TILE_SIZE = ASSETS_TILE_SIZE * ASSETS_TILE_SCALE;
const ASSETS_SCALED_ITEM_SIZE = ASSETS_TILE_SIZE * ASSETS_ITEM_SCALE;
const GROUP_CROP = 12 /* Tile.DoorClosed */;
const GROUP_ADD_BORDER = 18 /* Tile.Hero */;
const processTile = (image, offX, offY, size, scale, doCrop = true, borderSize = 0) => {
    let canvas = drawRegion(image, offX, offY, size, size);
    canvas = wrapCanvasFunc(eraseColor, canvas);
    if (doCrop) {
        canvas = wrapCanvasFunc(cropAlpha, canvas, getOpaqueBounds(canvas));
    }
    canvas = wrapCanvasFunc(scalePixelated, canvas, scale);
    if (borderSize > 0)
        canvas = wrapCanvasFunc(addPadding, canvas, borderSize);
    return canvas;
};
const assets = [];
const initAssets = (atlas) => {
    const rows = atlas.width / ASSETS_TILE_SIZE;
    const cols = atlas.height / ASSETS_TILE_SIZE;
    const scales = new Array(rows * cols).fill(ASSETS_ITEM_SCALE);
    for (let i = 0 /* Tile.Wall */; i <= 4 /* Tile.Candle */; i++) {
        scales[i] = ASSETS_TILE_SCALE;
    }
    scales[3 /* Tile.CoinHUD */] = 5;
    let x, y, i;
    for (y = 0; y < cols; y++) {
        for (x = 0; x < rows; x++) {
            i = x + y * rows;
            assets[i] = processTile(atlas, x * ASSETS_TILE_SIZE, y * ASSETS_TILE_SIZE, ASSETS_TILE_SIZE, scales[i], i >= GROUP_CROP, i < GROUP_ADD_BORDER ? 0 : ASSETS_BORDER_SIZE);
        }
    }
};

var ATLAS_URL = "assets/a.png";

var DEATH_DROP = [[[.3,0,29,,.07,.2,3,6,,,,.2],[.1,0,230,,.01,.12,3,1.5,,.4,,5.32,.01,,,,,5,.01],[.3,0,740,,,.15,2,.2,-.1,-.15,9,.02,,.1,.12,,.06],[.2,0,196,,,.74,,0,,.3,,,.29,,,,,.34,.14],[1.3,0,43,,,.25,,,,,,,,2],[.1,0,22,,.07,.07,4,0,,,.5,.01],[.1,0,22,.04,.08,,,0,,,,,,.7,,3,,,.17],[.1,0,2100,,,.2,3,0,,,-400,,,3.2,,,.15],[.1,0,245,.19,.09,1.19,1,0,,1.3,,,.08,,1.5,,.08,0,.17]],[[[,-.1,8,,,,,,8,,20,,8,,8,,,,,,8,,,,8,,20,,,,8,,,,11,,,,,,11,,23,,11,,11,,,,20,,11,,,,11,,23,,,,11,,,,],[1,,11,,,,6,,,,8,,,,11,,,,10,,,,6,,,,13,,,,10,,,,15,,,,13,,,,6,,,,8,,,,13,,,,11,,,,15,,,,11,,,,],[1,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,6,,,,,,6,,18,,,,6,,,,,,6,,,,6,,18,,,,6,,,,4,,,,,,4,,16,,,,4,,,,,,6,,6,,,,18,,,,6,,,,],[1,,18,,,,13,,,,10,,,,13,,,,11,,,,13,,,,10,,,,13,,,,8,,,,10,,,,11,,,,13,,,,10,,,,,,,,13,,,,,,,,],[,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,8,,,,,,8,,20,,8,,8,,,,,,8,,,,8,,20,,,,8,,,,11,,,,,,11,,23,,11,,11,,,,20,,11,,,,11,,23,,,,11,,,,],[1,,11,,,,6,,,,8,,,,11,,,,10,,,,6,,,,13,,,,10,,,,15,,,,13,,,,6,,,,8,,,,13,,,,11,,,,15,,,,11,,,,],[2,,15,,14,,15,,14,,,,,,,,,,,,,,,,,,,,,,,,,,19,,17,,15,,10,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,6,,,,,,6,,18,,,,6,,,,,,6,,,,6,,18,,,,6,,,,4,,,,,,4,,16,,,,4,,,,,,6,,6,,,,18,,,,6,,,,],[1,,18,,,,13,,,,10,,,,13,,,,11,,,,13,,,,10,,,,13,,,,8,,,,10,,,,11,,,,13,,,,10,,,,,,,,13,,,,,,,,],[2,,17,,15,,14,,10,,,,,,,,,,,,,,,,,,,,,,,,,,8,,,,10,,,,12,,,,15,,,,10,,,,14,,14,,,,,,,,,,]],[[,-.1,8,,,,,,8,,20,,8,,8,,,,,,8,,,,8,,20,,,,8,,,,11,,,,,,11,,23,,11,,11,,,,20,,11,,,,11,,23,,,,11,,,,],[1,,11,,,,6,,,,8,,,,11,,,,10,,,,6,,,,13,,,,10,,,,15,,,,13,,,,6,,,,8,,,,13,,,,11,,,,15,,,,11,,,,],[1,,15,,,,,,,,,,,,,,,,,,,,11,,13,,15,,13,,11,,6,,11,,,,,,,,,,,,,,,,,,,,11,,13,,11,,8,,8,,,,]],[[,-.1,6,,,,,,6,,18,,,,6,,,,,,6,,,,6,,18,,,,6,,,,4,,,,,,4,,16,,,,4,,,,,,6,,6,,,,18,,,,6,,,,],[1,-.2,18,,,,13,,,,10,,,,13,,,,11,,,,13,,,,10,,,,13,,,,8,,,,10,,,,11,,,,13,,,,10,,,,,,,,13,,,,,,,,],[1,,1,,,,,,13,,,,,,,,,,,,,,,,,,,,,,,,,,11,,,,,,,,13,,,,,,,,13,,,,,,,,18,,,,,,,,]],[[,-.1,8,,,,,,8,,20,,8,,8,,,,,,8,,,,8,,20,,,,8,,,,11,,,,,,11,,23,,11,,11,,,,20,,11,,,,11,,23,,,,11,,,,],[1,,11,,,,6,,,,8,,,,11,,,,10,,,,6,,,,13,,,,10,,,,15,,,,13,,,,6,,,,8,,,,13,,,,11,,,,15,,,,11,,,,],[1,,15,,,,,,,,,,,,,,,,,,,,11,,13,,15,,13,,11,,6,,11,,,,,,,,,,,,,,,,,,,,11,,13,,11,,8,,8,,,,],[2,,15,,14,,15,,14,,,,,,,,,,,,,,,,,,,,,,,,,,19,,17,,15,,10,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,6,,,,,,6,,18,,,,6,,,,,,6,,,,6,,18,,,,6,,,,4,,,,,,4,,16,,,,4,,,,,,6,,6,,,,18,,,,6,,,,],[1,-.2,18,,,,13,,,,10,,,,13,,,,11,,,,13,,,,10,,,,13,,,,8,,,,10,,,,11,,,,13,,,,10,,,,,,,,13,,,,,,,,],[1,,1,,,,,,13,,,,,,,,,,,,,,,,,,,,,,,,,,11,,,,,,,,,,,,,,,,13,,,,,,,,18,,,,,,,,],[2,,17,,15,,14,,10,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,15,,,,10,,,,14,,14,,,,,,,,,,]],[[,-.1,8,,,,,,8,,20,,8,,8,,,,,,8,,,,8,,20,,,,8,,,,11,,,,,,11,,23,,11,,11,,,,20,,11,,,,11,,23,,,,11,,,,],[1,,20,,,,22,,,,20,,,,18,,,,20,,,,,,,,15,,,,,,,,13,,,,11,,,,10,,,,6,,,,,,,,,,,,,,,,,,,,],[2,,15,17,15,17,15,,,,,,,,,,,,,,,,,,,,,,,,,,,,15,17,15,17,15,17,15,,,,,,,,,,,,,,,,,,,,,,,,,,],[8,,26,26,26,26,26,,,,,,,25,25,25,,,,,,,29,29,29,,,,,,,24,24,24,24,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,4,,,,,,4,,16,,,,4,,,,,,4,,,,4,,16,,,,4,,,,6,,,,,,6,,18,,,,6,,,,,,6,,6,,,,18,,,,6,,,,],[1,,16,,,,18,,,,16,,,,11,,,,,,,,,,,,,,,,,,,,18,,,,13,,,,11,,,,10,,,,,,,,,,,,,,,,,,,,],[8,,31,31,31,31,31,,,,,,,30,30,30,,,,,,,34,34,34,,,,,,,29,29,29,29,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,8,,,,,,8,,20,,8,,8,,,,,,8,,,,8,,20,,,,8,,,,11,,,,,,11,,23,,11,,11,,,,20,,11,,,,11,,23,,,,11,,,,],[1,,20,,,,22,,,,20,,,,18,,,,20,,,,,,,,15,,,,,,,,13,,,,11,,,,10,,,,6,,,,,,,,,,,,,,,,,,,,],[2,,15,,14,,15,,14,,,,,,,,,,,,,,,,,,,,,,,,,,19,,17,,15,,10,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,4,,,,,,4,,16,,,,4,,,,,,4,,,,4,,16,,,,4,,,,6,,,,,,6,,18,,,,6,,,,,,6,,6,,,,18,,,,6,,,,],[1,,16,,,,18,,,,16,,,,11,,,,,,,,,,,,,,,,,,,,10,,,,11,,,,12,,,,13,,,,10,,11,,12,,13,,10,,11,,12,,13,,],[2,,17,,15,,14,,10,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,,6,,6,,6,,6,,6,,,,,,,,6,,6,,6,,6,,6,,,,,,,,6,,6,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,],[1,,10,,11,,12,,13,,10,,11,,12,,13,,10,,11,,12,,13,,10,,11,,12,,10,,11,,12,,20,,,,19,,,,18,,,,17,,,,20,,,,19,,,,18,,,,],[3,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,16,,,,15,,,,14,,,,13,,,,16,,,,15,,,,14,,,,],[4,-.1,6,,6,,6,,6,,6,,,,,,,,6,,6,,6,,6,,6,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,],[5,,29,,29,,,,,,,,,,,,,,29,,29,,,,,,,,,,,,,,29,,29,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,8,,,,,,8,,20,,8,,8,,,,,,8,,,,8,,20,,,,8,,,,11,,,,,,11,,23,,11,,11,,,,23,,11,,,,11,,23,,,,11,,,,],[1,,11,,,,,,10,,,,,,3,,,,,,11,,,,,,10,,,,3,,,,11,,,,,,10,,,,,,1,,,,,,11,,,,,,10,,,,1,,,,],[3,,30,,,,,,,,,,,,,,,,30,,,,28,,,,26,,,,28,,,,26,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,],[3,,26,,,,,,,,,,,,,,,,26,,,,25,,,,23,,,,25,,,,18,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,4,,,,,,4,,16,,4,,4,,,,,,4,,,,4,,16,,,,4,,,,6,,,,,,6,,18,,6,,6,,,,18,,6,,,,6,,18,,,,6,,,,],[1,,11,,,,,,10,,,,,,4,,,,,,11,,,,,,10,,,,4,,,,11,,,,,,10,,,,,,6,,,,,,11,,,,,,10,,,,6,,,,],[3,,26,,,,,,,,,,,,,,,,,,,,,,,,26,,,,,,,,4,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,],[3,,23,,,,,,,,,,,,,,,,,,,,,,,,23,,,,,,,,25,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,4,,,,,,4,,16,,4,,4,,,,,,4,,,,4,,16,,,,4,,,,6,,,,,,6,,18,,6,,6,,,,18,,6,,,,6,,18,,,,6,,,,],[1,,11,10,11,10,11,10,,,4,,,,11,,,,10,,,,4,,,,11,,,,4,,,,11,10,11,10,11,10,,,6,,,,11,,,,10,,,,6,,,,11,,,,6,,,,],[3,,26,,,,,,,,,,,,,,,,,,,,,,,,26,,,,,,,,28,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,],[3,,23,,,,,,,,,,,,,,,,,,,,,,,,23,,,,,,,,25,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[,-.1,8,,,,,,8,,20,,8,,8,,,,,,8,,,,8,,20,,,,8,,,,11,,,,,,11,,23,,11,,11,,,,23,,11,,,,11,,23,,,,11,,,,],[1,,11,10,11,10,11,10,,,3,,,,11,,,,10,,,,3,,,,10,,,,3,,,,11,10,11,10,11,10,,,1,,,,11,,,,10,,,,1,,,,11,,,,1,,,,],[3,,30,,,,,,,,,,,,,,,,30,,,,28,,,,26,,,,28,,,,26,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,],[3,,26,,,,,,,,,,,,,,,,26,,,,25,,,,23,,,,25,,,,18,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]],[[7,,,,6,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,6,,,,],[1,,10,,11,,12,,13,,10,,11,,12,,13,,10,,11,,12,,13,,10,,11,,12,,10,,11,,12,,20,,,,19,,,,18,,,,17,,,,20,,,,19,,,,18,,,,],[3,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,16,,,,15,,,,14,,,,13,,,,16,,,,15,,,,14,,,,],[4,-.1,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,6,,],[5,,29,,29,,,,,,,,,,,,,,29,,29,,,,,,,,,,,,,,29,,29,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,],[6,,,29,,29,,29,,29,,,,,,,,,,29,,29,,29,,29,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,],[2,,15,,16,,17,,18,,15,,16,,17,,18,,15,,16,,17,,18,,15,,16,,17,,18,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,]]],[0,1,2,3,4,5,6,7,8,9,10,11,12,17,14,13,15,16,12],210];

var accumulateFragmentShader = "precision mediump float;\n#define GLSLIFY 1\nvarying vec2 uv;uniform sampler2D tex0;uniform sampler2D tex1;uniform float modulate;void main(){vec4 a=texture2D(tex0,uv)*vec4(modulate);vec4 b=texture2D(tex1,uv);gl_FragColor=max(a,b*0.96);}"; // eslint-disable-line

var blendFragmentShader = "precision mediump float;\n#define GLSLIFY 1\nvarying vec2 uv;uniform sampler2D tex0;uniform sampler2D tex1;uniform float modulate;void main(){vec4 a=texture2D(tex0,uv)*vec4(modulate);vec4 b=texture2D(tex1,uv);gl_FragColor=max(a,b*0.32);}"; // eslint-disable-line

var blurFragmentShader = "precision mediump float;\n#define GLSLIFY 1\nvarying vec2 uv;uniform vec2 blur;uniform sampler2D texture;void main(){vec4 sum=texture2D(texture,uv)*0.2270270270;sum+=texture2D(texture,vec2(uv.x-4.0*blur.x,uv.y-4.0*blur.y))*0.0162162162;sum+=texture2D(texture,vec2(uv.x-3.0*blur.x,uv.y-3.0*blur.y))*0.0540540541;sum+=texture2D(texture,vec2(uv.x-2.0*blur.x,uv.y-2.0*blur.y))*0.1216216216;sum+=texture2D(texture,vec2(uv.x-1.0*blur.x,uv.y-1.0*blur.y))*0.1945945946;sum+=texture2D(texture,vec2(uv.x+1.0*blur.x,uv.y+1.0*blur.y))*0.1945945946;sum+=texture2D(texture,vec2(uv.x+2.0*blur.x,uv.y+2.0*blur.y))*0.1216216216;sum+=texture2D(texture,vec2(uv.x+3.0*blur.x,uv.y+3.0*blur.y))*0.0540540541;sum+=texture2D(texture,vec2(uv.x+4.0*blur.x,uv.y+4.0*blur.y))*0.0162162162;gl_FragColor=sum;}"; // eslint-disable-line

var commonVertexShader = "#define GLSLIFY 1\nattribute vec4 pos;varying vec2 uv;void main(){gl_Position=vec4(pos.xy,0,1);uv=pos.zw;}"; // eslint-disable-line

var copyFragmentShader = "precision mediump float;\n#define GLSLIFY 1\nvarying vec2 uv;uniform sampler2D tex0;void main(){gl_FragColor=texture2D(tex0,uv);}"; // eslint-disable-line

var crtFragmentShader = "precision mediump float;\n#define GLSLIFY 1\nvarying vec2 uv;uniform vec2 resolution;uniform float time;uniform sampler2D backbuffer;uniform sampler2D blurbuffer;vec3 tsample(sampler2D samp,vec2 tc){vec3 s=pow(abs(texture2D(samp,vec2(tc.x,1.0-tc.y)).rgb),vec3(2.2));return s*vec3(1.25);}vec3 filmic(vec3 lcol){vec3 x=max(vec3(0),lcol-vec3(0.004));return(x*(6.2*x+0.5))/(x*(6.2*x+1.7)+0.06);}vec2 curve(vec2 uv){uv=(uv-0.5)*2.0;uv*=vec2(1.049,1.042);uv-=vec2(-0.008,0.008);uv.x*=1.0+pow(abs(uv.y)/5.0,2.0);uv.y*=1.0+pow(abs(uv.x)/4.0,2.0);uv=uv*0.5+0.5;return uv;}highp float rand(vec2 co){highp float a=12.9898;highp float b=78.233;highp float c=43758.5453;highp float dt=dot(co.xy,vec2(a,b));highp float sn=mod(dt,3.14);return fract(sin(sn)*c);}void main(){vec2 curved_uv=mix(curve(uv),uv,0.4);\n#if 0\nfloat scale=0.04;vec2 scuv=curved_uv*(1.0-scale)+scale*0.5+vec2(0.003,-0.001);\n#else\nvec2 scuv=curved_uv;\n#endif\nvec3 col;float x=sin(0.1*time+curved_uv.y*13.0)*sin(0.23*time+curved_uv.y*19.0)*sin(0.3+0.11*time+curved_uv.y*23.0)*0.0012;float o=sin(gl_FragCoord.y/1.5)/resolution.x;x+=o*0.25;x*=0.2;col.r=tsample(backbuffer,vec2(x+scuv.x+0.0009,scuv.y+0.0009)).x+0.02;col.g=tsample(backbuffer,vec2(x+scuv.x+0.0000,scuv.y-0.0011)).y+0.02;col.b=tsample(backbuffer,vec2(x+scuv.x-0.0015,scuv.y+0.0000)).z+0.02;float i=clamp(col.r*0.299+col.g*0.587+col.b*0.114,0.0,1.0);i=pow(1.0-pow(i,2.0),1.0);i=(1.0-i)*0.85+0.15;float ghs=0.15;vec3 r=tsample(blurbuffer,vec2(x-0.014*1.0,-0.027)*0.85+0.007*vec2(0.35*sin(1.0/7.0+15.0*curved_uv.y+0.9*time),0.35*sin(2.0/7.0+10.0*curved_uv.y+1.37*time))+vec2(scuv.x+0.001,scuv.y+0.001)).xyz*vec3(0.5,0.25,0.25);vec3 g=tsample(blurbuffer,vec2(x-0.019*1.0,-0.020)*0.85+0.007*vec2(0.35*cos(1.0/9.0+15.0*curved_uv.y+0.5*time),0.35*sin(2.0/9.0+10.0*curved_uv.y+1.50*time))+vec2(scuv.x+0.000,scuv.y-0.002)).xyz*vec3(0.25,0.5,0.25);vec3 b=tsample(blurbuffer,vec2(x-0.017*1.0,-0.003)*0.85+0.007*vec2(0.35*sin(2.0/3.0+15.0*curved_uv.y+0.7*time),0.35*cos(2.0/3.0+10.0*curved_uv.y+1.63*time))+vec2(scuv.x-0.002,scuv.y+0.000)).xyz*vec3(0.25,0.25,0.5);vec3 ghost=vec3(0.0);ghost+=vec3(ghs*(1.0-0.299))*pow(clamp(vec3(3.0)*r,vec3(0.0),vec3(1.0)),vec3(2.0))*vec3(i);ghost+=vec3(ghs*(1.0-0.587))*pow(clamp(vec3(3.0)*g,vec3(0.0),vec3(1.0)),vec3(2.0))*vec3(i);ghost+=vec3(ghs*(1.0-0.114))*pow(clamp(vec3(3.0)*b,vec3(0.0),vec3(1.0)),vec3(2.0))*vec3(i);col+=ghost;col*=vec3(0.95,1.05,0.95);col=clamp(1.3*col+0.75*col*col+1.25*col*col*col*col*col,vec3(0.0),vec3(10.0));float vig=0.1+16.0*curved_uv.x*curved_uv.y*(1.0-curved_uv.x)*(1.0-curved_uv.y);\n#if 0\nvig=1.3*pow(vig,0.5);\n#else\nvig=1.5*pow(vig,0.25);vig=(vig>1.0)?(1.0+smoothstep(1.0,1.5,vig)*0.2): vig;\n#endif\ncol*=vig;float scans=clamp(0.35+0.18*sin(6.0*time+curved_uv.y*resolution.y*1.5),0.0,1.0);float s=pow(scans,0.9);col*=s;col*=1.0-0.23*clamp((mod(gl_FragCoord.xy.x,3.0))*0.5,0.0,1.0);col=filmic(col);vec2 seed=curved_uv*resolution.xy;vec3 noise=pow(vec3(rand(seed+time),rand(seed+time*2.0),rand(seed+time*3.0)),vec3(1.5));col-=0.015*noise;col*=(1.0-0.004*(sin(50.0*time+curved_uv.y*2.0)*0.5+0.5));if(curved_uv.x<0.0||curved_uv.x>1.0)col*=0.0;if(curved_uv.y<0.0||curved_uv.y>1.0)col*=0.0;col*=vec3(1.1);gl_FragColor=vec4(col,1.0);}"; // eslint-disable-line

const initRenderer = (targetCanvas) => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    const glGetUniformLocation = gl.getUniformLocation.bind(gl);
    const targetContext = targetCanvas.getContext("2d");
    const unbind = (...args) => {
        for (const arg of args) {
            switch (arg) {
                case 36160 /* GL.FRAMEBUFFER */:
                    gl.bindFramebuffer(arg, null);
                    break;
                case 3553 /* GL.TEXTURE_2D */:
                    gl.bindTexture(arg, null);
                    break;
                case 34962 /* GL.ARRAY_BUFFER */:
                    gl.bindBuffer(arg, null);
                    break;
                default:
                    gl.activeTexture(arg);
                    gl.bindTexture(3553 /* GL.TEXTURE_2D */, null);
            }
        }
    };
    const compileShader = (source, type) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, 35713 /* GL.COMPILE_STATUS */)) {
            const info = gl.getShaderInfoLog(shader);
            throw "could not compile shader:" + info;
        }
        return shader;
    };
    const vs = compileShader(commonVertexShader, 35633 /* GL.VERTEX_SHADER */);
    const fs_crt = compileShader(crtFragmentShader, 35632 /* GL.FRAGMENT_SHADER */);
    const fs_blur = compileShader(blurFragmentShader, 35632 /* GL.FRAGMENT_SHADER */);
    const fs_accumulate = compileShader(accumulateFragmentShader, 35632 /* GL.FRAGMENT_SHADER */);
    const fs_blend = compileShader(blendFragmentShader, 35632 /* GL.FRAGMENT_SHADER */);
    const fs_copy = compileShader(copyFragmentShader, 35632 /* GL.FRAGMENT_SHADER */);
    const createProgram = (vs, fs, name) => {
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, 35714 /* GL.LINK_STATUS */)) {
            const info = gl.getProgramInfoLog(program);
            throw "shader " + name + " failed to link:" + info;
        }
        return program;
    };
    const crt_program = createProgram(vs, fs_crt, "crt_program");
    const loc_crt_pos = gl.getAttribLocation(crt_program, "pos");
    const loc_crt_time = glGetUniformLocation(crt_program, "time");
    const loc_crt_backbuffer = glGetUniformLocation(crt_program, "backbuffer");
    const loc_crt_blurbuffer = glGetUniformLocation(crt_program, "blurbuffer");
    const loc_crt_resolution = glGetUniformLocation(crt_program, "resolution");
    const blur_program = createProgram(vs, fs_blur, "blur_program");
    const loc_blur_pos = gl.getAttribLocation(blur_program, "pos");
    const loc_blur_blur = glGetUniformLocation(blur_program, "blur");
    const loc_blur_texture = glGetUniformLocation(blur_program, "texture");
    const accumulate_program = createProgram(vs, fs_accumulate, "accumulate_program");
    const loc_accumulate_pos = gl.getAttribLocation(accumulate_program, "pos");
    const loc_accumulate_tex0 = glGetUniformLocation(accumulate_program, "tex0");
    const loc_accumulate_tex1 = glGetUniformLocation(accumulate_program, "tex1");
    const loc_accumulate_modulate = glGetUniformLocation(accumulate_program, "modulate");
    const blend_program = createProgram(vs, fs_blend, "blend_program");
    const loc_blend_pos = gl.getAttribLocation(blend_program, "pos");
    const loc_blend_tex0 = glGetUniformLocation(blend_program, "tex0");
    const loc_blend_tex1 = glGetUniformLocation(blend_program, "tex1");
    const loc_blend_modulate = glGetUniformLocation(blend_program, "modulate");
    const copy_program = createProgram(vs, fs_copy, "copy_program");
    const loc_copy_pos = gl.getAttribLocation(copy_program, "pos");
    const loc_copy_tex0 = glGetUniformLocation(copy_program, "tex0");
    const posBuffer = gl.createBuffer();
    const bindVertexBuffer = (loc_pos) => {
        gl.bindBuffer(34962 /* GL.ARRAY_BUFFER */, posBuffer);
        gl.vertexAttribPointer(loc_pos, 4, 5126 /* GL.FLOAT */, false, 0, 0);
        gl.enableVertexAttribArray(loc_pos);
    };
    const tex_backbuffer = gl.createTexture();
    const texFbos = [];
    const drawBlurAxis = (srcTex, dstBuf, blurX, blurY) => {
        gl.bindFramebuffer(36160 /* GL.FRAMEBUFFER */, dstBuf);
        gl.useProgram(blur_program);
        bindVertexBuffer(loc_blur_pos);
        gl.uniform2f(loc_blur_blur, blurX, blurY);
        gl.uniform1i(loc_blur_texture, 0);
        gl.activeTexture(33984 /* GL.TEXTURE0 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, srcTex);
        gl.drawArrays(6 /* GL.TRIANGLE_FAN */, 0, 4);
        unbind(3553 /* GL.TEXTURE_2D */, 34962 /* GL.ARRAY_BUFFER */, 36160 /* GL.FRAMEBUFFER */);
    };
    const drawBlur = (srcTex, dstBuf, tmp, r, w, h) => {
        drawBlurAxis(srcTex, tmp.fbo, r / w, 0);
        drawBlurAxis(tmp.tex, dstBuf, 0, r / h);
    };
    const drawCopy = (srcTex, dstBuf) => {
        gl.bindFramebuffer(36160 /* GL.FRAMEBUFFER */, dstBuf);
        gl.useProgram(copy_program);
        bindVertexBuffer(loc_copy_pos);
        gl.uniform1i(loc_copy_tex0, 0);
        gl.activeTexture(33984 /* GL.TEXTURE0 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, srcTex);
        gl.drawArrays(6 /* GL.TRIANGLE_FAN */, 0, 4);
        unbind(3553 /* GL.TEXTURE_2D */, 34962 /* GL.ARRAY_BUFFER */, 36160 /* GL.FRAMEBUFFER */);
    };
    let lastDw = -1;
    let lastDh = -1;
    let i;
    let targetScale;
    canvas.style.cssText = "display:block;margin:0 auto;height:100%;";
    canvas.width = targetCanvas.clientWidth;
    canvas.height = targetCanvas.clientHeight;
    targetCanvas.parentNode.insertBefore(canvas, targetCanvas);
    targetCanvas.style.opacity = "0";
    gl.bindBuffer(34962 /* GL.ARRAY_BUFFER */, posBuffer);
    gl.bufferData(34962 /* GL.ARRAY_BUFFER */, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, 1, 1, 1, 1, -1, 1, 0, 1]), 35044 /* GL.STATIC_DRAW */);
    unbind(34962 /* GL.ARRAY_BUFFER */);
    gl.activeTexture(33984 /* GL.TEXTURE0 */);
    gl.bindTexture(3553 /* GL.TEXTURE_2D */, tex_backbuffer);
    gl.texParameteri(3553 /* GL.TEXTURE_2D */, 10242 /* GL.TEXTURE_WRAP_S */, 33071 /* GL.CLAMP_TO_EDGE */);
    gl.texParameteri(3553 /* GL.TEXTURE_2D */, 10243 /* GL.TEXTURE_WRAP_T */, 33071 /* GL.CLAMP_TO_EDGE */);
    gl.texParameteri(3553 /* GL.TEXTURE_2D */, 10241 /* GL.TEXTURE_MIN_FILTER */, 9728 /* GL.NEAREST */);
    gl.texParameteri(3553 /* GL.TEXTURE_2D */, 10240 /* GL.TEXTURE_MAG_FILTER */, 9728 /* GL.NEAREST */);
    unbind(3553 /* GL.TEXTURE_2D */);
    for (i = 0; i < 4; ++i) {
        const tex = gl.createTexture();
        const fbo = gl.createFramebuffer();
        gl.activeTexture(33984 /* GL.TEXTURE0 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, tex);
        gl.texParameteri(3553 /* GL.TEXTURE_2D */, 10242 /* GL.TEXTURE_WRAP_S */, 33071 /* GL.CLAMP_TO_EDGE */);
        gl.texParameteri(3553 /* GL.TEXTURE_2D */, 10243 /* GL.TEXTURE_WRAP_T */, 33071 /* GL.CLAMP_TO_EDGE */);
        gl.texParameteri(3553 /* GL.TEXTURE_2D */, 10241 /* GL.TEXTURE_MIN_FILTER */, 9729 /* GL.LINEAR */);
        gl.texParameteri(3553 /* GL.TEXTURE_2D */, 10240 /* GL.TEXTURE_MAG_FILTER */, 9729 /* GL.LINEAR */);
        unbind(3553 /* GL.TEXTURE_2D */);
        texFbos.push({ tex, fbo });
    }
    const blur_buf = texFbos[0];
    const blur_tmp = texFbos[1];
    const accum_buf = texFbos[2];
    const accum_cpy = texFbos[3];
    return (now) => {
        /* hack fix for Safari: texImage2D fails to copy targetCanvas to tex_backbuffer */
        targetContext.resetTransform();
        targetContext.clearRect(-1, -1, 1, 1);
        targetScale = Math.ceil(Math.max(targetCanvas.clientWidth / targetCanvas.width, targetCanvas.clientHeight / targetCanvas.height));
        targetScale = Math.max(1, Math.min(4, targetScale));
        const dw = targetCanvas.width * targetScale;
        const dh = targetCanvas.height * targetScale;
        const cw = (canvas.width = targetCanvas.clientWidth);
        const ch = (canvas.height = targetCanvas.clientHeight);
        const time = now * 0.001;
        if (lastDw != dw || lastDh != dh) {
            for (const { tex: texture, fbo: framebuffer } of texFbos) {
                gl.activeTexture(33984 /* GL.TEXTURE0 */);
                gl.bindTexture(3553 /* GL.TEXTURE_2D */, texture);
                gl.texImage2D(3553 /* GL.TEXTURE_2D */, 0, 6408 /* GL.RGBA */, dw, dh, 0, 6408 /* GL.RGBA */, 5121 /* GL.UNSIGNED_BYTE */, null);
                gl.bindFramebuffer(36160 /* GL.FRAMEBUFFER */, framebuffer);
                gl.framebufferTexture2D(36160 /* GL.FRAMEBUFFER */, 36064 /* GL.COLOR_ATTACHMENT0 */, 3553 /* GL.TEXTURE_2D */, texture, 0);
                unbind(3553 /* GL.TEXTURE_2D */, 36160 /* GL.FRAMEBUFFER */);
            }
        }
        /* blit targe screen to backbuffer; backbuffer = texImage2D(targetCanvas) */
        gl.activeTexture(33984 /* GL.TEXTURE0 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, tex_backbuffer);
        gl.texImage2D(3553 /* GL.TEXTURE_2D */, 0, 6408 /* GL.RGBA */, 6408 /* GL.RGBA */, 5121 /* GL.UNSIGNED_BYTE */, targetCanvas);
        unbind(3553 /* GL.TEXTURE_2D */);
        gl.viewport(0, 0, dw, dh);
        /* blur previous accumulation buffer; blur_buf = blur(accum_cpy) */
        drawBlur(accum_cpy.tex, blur_buf.fbo, blur_tmp, 1.0, dw, dh);
        /* update accumulation buffer; accum_buf = accumulate(backbuffer, blur_buf) */
        gl.bindFramebuffer(36160 /* GL.FRAMEBUFFER */, accum_buf.fbo);
        gl.useProgram(accumulate_program);
        bindVertexBuffer(loc_accumulate_pos);
        gl.uniform1i(loc_accumulate_tex0, 0);
        gl.uniform1i(loc_accumulate_tex1, 1);
        gl.uniform1f(loc_accumulate_modulate, 1.0);
        gl.activeTexture(33984 /* GL.TEXTURE0 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, tex_backbuffer);
        gl.activeTexture(33985 /* GL.TEXTURE1 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, blur_buf.tex);
        gl.drawArrays(6 /* GL.TRIANGLE_FAN */, 0, 4);
        unbind(33984 /* GL.TEXTURE0 */, 33985 /* GL.TEXTURE1 */, 34962 /* GL.ARRAY_BUFFER */, 36160 /* GL.FRAMEBUFFER */);
        /* store copy of accumulation buffer; accum_cpy = copy(accum_buf) */
        drawCopy(accum_buf.tex, accum_cpy.fbo);
        /* blend accumulation and backbuffer; accum_buf = blend(backbuffer, accum_cpy) */
        gl.bindFramebuffer(36160 /* GL.FRAMEBUFFER */, accum_buf.fbo);
        gl.useProgram(blend_program);
        bindVertexBuffer(loc_blend_pos);
        gl.uniform1i(loc_blend_tex0, 0);
        gl.uniform1i(loc_blend_tex1, 1);
        gl.uniform1f(loc_blend_modulate, 1.0);
        gl.activeTexture(33984 /* GL.TEXTURE0 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, tex_backbuffer);
        gl.activeTexture(33985 /* GL.TEXTURE1 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, accum_cpy.tex);
        gl.drawArrays(6 /* GL.TRIANGLE_FAN */, 0, 4);
        unbind(33984 /* GL.TEXTURE0 */, 33985 /* GL.TEXTURE1 */, 34962 /* GL.ARRAY_BUFFER */, 36160 /* GL.FRAMEBUFFER */);
        /* add slight blur to backbuffer; accum_buf = blur(accum_buf) */
        drawBlur(accum_buf.tex, accum_buf.fbo, blur_tmp, 0.17, dw, dh);
        /* create fully blurred version of backbuffer; blur_buf = blur(accum_buf) */
        drawBlur(accum_buf.tex, blur_buf.fbo, blur_tmp, 1.0, dw, dh);
        /* ensure crt canvas overlays targetCanvas */
        gl.viewport(0, 0, cw, ch);
        /* apply crt shader; canvas = crt(accum_buf, blur_buf) */
        gl.bindFramebuffer(36160 /* GL.FRAMEBUFFER */, null);
        gl.useProgram(crt_program);
        bindVertexBuffer(loc_crt_pos);
        gl.activeTexture(33984 /* GL.TEXTURE0 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, accum_buf.tex);
        gl.activeTexture(33985 /* GL.TEXTURE1 */);
        gl.bindTexture(3553 /* GL.TEXTURE_2D */, blur_buf.tex);
        gl.uniform2f(loc_crt_resolution, cw, ch);
        gl.uniform1f(loc_crt_time, 1.5 * time);
        gl.uniform1i(loc_crt_backbuffer, 0);
        gl.uniform1i(loc_crt_blurbuffer, 1);
        gl.drawArrays(6 /* GL.TRIANGLE_FAN */, 0, 4);
        unbind(33984 /* GL.TEXTURE0 */, 33985 /* GL.TEXTURE1 */, 34962 /* GL.ARRAY_BUFFER */, 36160 /* GL.FRAMEBUFFER */);
        lastDw = dw;
        lastDh = dh;
    };
};

const createDisplayObject = (width, height, render, props) => {
    const obj = Object.assign({ x: 0, y: 0, width,
        height, borderSize: 0, pivotX: 0, pivotY: 0, rotation: 0, alpha: 1, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, init() { },
        update(dt) { },
        render,
        destroy() { },
        getGlobalX() {
            return obj.stage ? obj.x + obj.stage.getGlobalX() : obj.x;
        },
        getGlobalY() {
            return obj.stage ? obj.y + obj.stage.getGlobalY() : obj.y;
        },
        getHalfWidth() {
            return obj.width / 2;
        },
        getHalfHeight() {
            return obj.height / 2;
        },
        getCenterX() {
            return obj.x + obj.getHalfWidth();
        },
        getCenterY() {
            return obj.y + obj.getHalfHeight();
        } }, props);
    if (props)
        obj.init();
    return obj;
};

const createStage = (width, height, props) => {
    const stage = Object.assign(createDisplayObject(width, height, (ctx) => {
        stage.children.forEach((obj) => {
            ctx.save();
            ctx.translate(stage.x + obj.x - obj.borderSize + (obj.width + obj.borderSize * 2) * obj.pivotX, stage.y + obj.y - obj.borderSize + (obj.height + obj.borderSize * 2) * obj.pivotY);
            ctx.rotate(obj.rotation);
            ctx.globalAlpha = obj.alpha * stage.alpha;
            ctx.scale(obj.scaleX, obj.scaleY);
            obj.render(ctx);
            ctx.restore();
        });
    }), {
        children: [],
        addChild(obj) {
            obj.stage = stage;
            stage.children.push(obj);
        },
        removeChild(obj) {
            if (stage.children.indexOf(obj) < 0) {
                console.warn("[Stage] Trying to delete odd child", obj);
                return;
            }
            stage.children.splice(stage.children.indexOf(obj), 1);
            obj.stage = undefined;
        },
        addMany(...all) {
            all.forEach((obj) => obj && stage.addChild(obj));
        },
        removeAll() {
            stage.children.forEach((child) => (child.stage = undefined));
            stage.children = [];
        },
        hasChildren() {
            return stage.children.length > 0;
        },
        update(dt) {
            stage.children.forEach((obj) => {
                obj.update(dt);
            });
        }
    }, props);
    if (props)
        stage.init();
    return stage;
};

const smoothstep = (x) => x * x * (3 - 2 * x);
const sine = (x) => Math.sin((x * Math.PI) / 2);
const easeOutBack = (x) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const tweens = [];
const tweenProp = (totalFrames, startValue, endValue, ease, update, onComplete) => {
    let frameCounter = 0;
    const tween = () => {
        if (frameCounter < totalFrames) {
            const normalizedTime = frameCounter / totalFrames, curvedTime = ease(normalizedTime);
            update(endValue * curvedTime + startValue * (1 - curvedTime));
            frameCounter += 1;
        }
        else {
            if (onComplete)
                onComplete();
            tweens.splice(tweens.indexOf(tween), 1);
        }
    };
    tweens.push(tween);
};
const updateTweens = (dt) => {
    if (tweens.length > 0) {
        for (let updateTween, i = tweens.length - 1; i >= 0; i--) {
            updateTween = tweens[i];
            if (updateTween)
                updateTween();
        }
    }
};

const createSprite = (image, props) => {
    let imageWidth = image.width;
    let imageHeight = image.height;
    const sprite = Object.assign(createDisplayObject(imageWidth, imageHeight, (ctx) => {
        ctx.transform(1, sprite.skewY, sprite.skewX, 1, 0, 0);
        ctx.drawImage(sprite.image, 0, 0, imageWidth, imageHeight, -imageWidth * sprite.pivotX, -imageHeight * sprite.pivotY, imageWidth, imageHeight);
    }), {
        image,
        setImage(image) {
            imageWidth = image.width;
            imageHeight = image.height;
            this.image = image;
            sprite.width = imageWidth - sprite.borderSize * 2;
            sprite.height = imageHeight - sprite.borderSize * 2;
        },
        init() {
            sprite.width -= sprite.borderSize * 2;
            sprite.height -= sprite.borderSize * 2;
        }
    }, props);
    if (props)
        sprite.init();
    return sprite;
};

const createColoredSprite = (tile, color, props) => {
    const image = colorizeImage(assets[tile], color);
    const sprite = createSprite(image);
    const superInit = sprite.init;
    const colorSprite = Object.assign(sprite, {
        color,
        outlineSize: 0,
        outlineColor: "#201208" /* Color.BrownDark */,
        init() {
            const sos = colorSprite.outlineSize;
            if (sos > 0) {
                colorSprite.borderSize += sos;
                colorSprite.setImage(wrapCanvasFunc(addOutline, colorSprite.image, sos, colorSprite.outlineColor));
            }
            else {
                superInit();
            }
        },
        destroy() {
            canvasPool.free(colorSprite.image);
        }
    }, props);
    if (props)
        colorSprite.init();
    return colorSprite;
};

const rectangleCollision = (obj1, obj2, bounce = false) => {
    let collision;
    let overlapX;
    let overlapY;
    // TODO: optimize
    const vx = obj1.getGlobalX() + obj1.getHalfWidth() - (obj2.getGlobalX() + obj2.getHalfWidth());
    const vy = obj1.getGlobalY() + obj1.getHalfHeight() - (obj2.getGlobalY() + obj2.getHalfHeight());
    const combinedHalfWidths = obj1.getHalfWidth() + obj2.getHalfWidth();
    const combinedHalfHeights = obj1.getHalfHeight() + obj2.getHalfHeight();
    if (Math.abs(vx) < combinedHalfWidths) {
        if (Math.abs(vy) < combinedHalfHeights) {
            overlapX = combinedHalfWidths - Math.abs(vx);
            overlapY = combinedHalfHeights - Math.abs(vy);
            if (overlapX >= overlapY) {
                if (vy > 0) {
                    collision = 0 /* CollisionSide.Top */;
                    obj1.y = obj1.y + overlapY;
                }
                else {
                    collision = 1 /* CollisionSide.Bottom */;
                    obj1.y = obj1.y - overlapY;
                }
                if (bounce && obj1.vy)
                    obj1.vy *= -1;
            }
            else {
                if (vx > 0) {
                    collision = 2 /* CollisionSide.Left */;
                    obj1.x = obj1.x + overlapX;
                }
                else {
                    collision = 3 /* CollisionSide.Right */;
                    obj1.x = obj1.x - overlapX;
                }
                if (bounce && obj1.vx)
                    obj1.vx *= -1;
            }
        }
    }
    return collision;
};
const hitTestRectangle = (obj1, obj2) => obj1.x < obj2.x + obj2.width &&
    obj1.x + obj1.width > obj2.x &&
    obj1.y < obj2.y + obj2.height &&
    obj1.y + obj1.height > obj2.y;

const zzfx=(...t)=>zzfxP(zzfxG(...t)),
  zzfxP=(...t)=>{let e=zzfxX.createBufferSource(),f=zzfxX.createBuffer(t.length,t[0].length,zzfxR);t.map((d,i)=>f.getChannelData(i).set(d)),e.buffer=f,e.connect(zzfxX.destination),e.start();return e},
  zzfxG=(q=1,k=.05,c=220,e=0,t=0,u=.1,r=0,F=1,v=0,z=0,w=0,A=0,l=0,B=0,x=0,G=0,d=0,y=1,m=0,C=0)=>{let b=2*Math.PI,H=v*=500*b/zzfxR**2,I=(0<x?1:-1)*b/4,D=c*=(1+2*k*Math.random()-k)*b/zzfxR,Z=[],g=0,E=0,a=0,n=1,J=0,K=0,f=0,p,h;e=99+zzfxR*e;m*=zzfxR;t*=zzfxR;u*=zzfxR;d*=zzfxR;z*=500*b/zzfxR**3;x*=b/zzfxR;w*=b/zzfxR;A*=zzfxR;l=zzfxR*l|0;for(h=e+m+t+u+d|0;a<h;Z[a++]=f)++K%(100*G|0)||(f=r?1<r?2<r?3<r?Math.sin((g%b)**3):Math.max(Math.min(Math.tan(g),1),-1):1-(2*g/b%2+2)%2:1-4*Math.abs(Math.round(g/b)-g/b):Math.sin(g),f=(l?1-C+C*Math.sin(2*Math.PI*a/l):1)*(0<f?1:-1)*Math.abs(f)**F*q*zzfxV*(a<e?a/e:a<e+m?1-(a-e)/m*(1-y):a<e+m+t?y:a<h-d?(h-a-d)/u*y:0),f=d?f/2+(d>a?0:(a<h-d?1:(h-a)/d)*Z[a-d|0]/2):f),p=(c+=v+=z)*Math.sin(E*x-I),g+=p-p*B*(1-1E9*(Math.sin(a)+1)%2),E+=p-p*B*(1-1E9*(Math.sin(a)**2+1)%2),n&&++n>A&&(c+=w,D+=w,n=0),!l||++J%l||(c=D,v=H,n=n||1);return Z},
  zzfxV=.3,
  zzfxR=44100,
  zzfxX=new(window.AudioContext||webkitAudioContext),
  zzfxM=(n,f,t,e=125)=>{let l,o,z,r,g,h,x,a,u,c,i,m,p,G,M=0,R=[],b=[],j=[],k=0,q=0,s=1,v={},w=zzfxR/e*60>>2;for(;s;k++)R=[s=a=m=0],t.map((e,d)=>{for(x=f[e][k]||[0,0,0],s|=!!f[e][k],G=m+(f[e][0].length-2-!a)*w,p=d==t.length-1,o=2,r=m;o<x.length+p;a=++o){for(g=x[o],u=o==x.length+p-1&&p||c!=(x[0]||0)|g|0,z=0;z<w&&a;z++>w-99&&u?i+=(i<1)/99:0)h=(1-i)*R[M++]/2||0,b[r]=(b[r]||0)-h*q+h,j[r]=(j[r++]||0)+h*q+h;g&&(i=g%1,q=x[1]||0,(g|=0)&&(R=v[[c=x[M=0]||0,g]]=v[[c,g]]||(l=[...n[c]],l[2]*=2**((g-12)/12),g>0?zzfxG(...l):[])));}m=G;});return [b,j]};

const unlockAudio = (force = false) => {
    if (force || zzfxX.state === "suspended") {
        zzfxX.resume().catch();
    }
};

const KEY_LEFT = 37;
const KEY_RIGHT = 39;
const KEY_UP = 38;
const KEY_DOWN = 40;
const SPACE = 32;
const ENTER = 13;
let isLeftKeyDown = false;
let isRightKeyDown = false;
let isSpaceDown = false;
onkeydown = (event) => {
    unlockAudio();
    const { keyCode } = event;
    if (keyCode === KEY_LEFT) {
        isLeftKeyDown = true;
    }
    if (keyCode === KEY_RIGHT) {
        isRightKeyDown = true;
    }
    if (keyCode === SPACE) {
        isSpaceDown = true;
    }
};
onkeyup = (event) => {
    const { keyCode } = event;
    if (keyCode === KEY_LEFT) {
        isLeftKeyDown = false;
    }
    if (keyCode === KEY_RIGHT) {
        isRightKeyDown = false;
    }
    if (keyCode === SPACE) {
        isSpaceDown = false;
    }
};
const bindKey = (keyCode) => {
    const key = {
        code: keyCode,
        isDown: false,
        isUp: false,
        downHandler: (event) => {
            if (event.keyCode === key.code) {
                if (key.isUp && key.press)
                    key.press();
                key.isDown = true;
                key.isUp = false;
            }
            // event.preventDefault();
        },
        upHandler: (event) => {
            if (event.keyCode === key.code) {
                if (key.isDown && key.release)
                    key.release();
                key.isDown = false;
                key.isUp = true;
            }
            // event.preventDefault();
        }
    };
    addEventListener("keydown", key.downHandler.bind(key));
    addEventListener("keyup", key.upHandler.bind(key));
    return key;
};

const createPRNG = (seed = 1) => {
    const gen = () => (seed = (seed * 16807) % 2147483647);
    const nextInt = () => gen();
    const nextDouble = () => gen() / 2147483647;
    const nextBoolean = () => gen() % 2 === 0;
    const nextIntRange = (min, max) => Math.round(min + (max - min) * nextDouble());
    const nextDoubleRange = (min, max) => min + (max - min) * nextDouble();
    return {
        set seed(value) {
            seed = value;
        },
        get seed() {
            return seed;
        },
        nextInt,
        nextDouble,
        nextBoolean,
        nextIntRange,
        nextDoubleRange
    };
};
const random = createPRNG();

const createRectShape = (width, height, props) => {
    const shape = Object.assign(createDisplayObject(width, height, (ctx) => {
        ctx.fillStyle = shape.color;
        ctx.fillRect(0, 0, shape.width, shape.height);
    }), {
        color: "0"
    }, props);
    if (props)
        shape.init();
    return shape;
};

const initFont = (chars) => (ctx, string, x, y, size, color) =>
  [...string].reduce((charX, char) => {
    const height = 5,
      pixelSize = size / height,
      fontCode = chars[char.charCodeAt()] || "",
      binaryChar = fontCode > 0 ? fontCode : fontCode.codePointAt(),
      binary = (binaryChar || 0).toString(2),
      width = Math.ceil(binary.length / height),
      marginX = charX + pixelSize,
      formattedBinary = binary.padStart(width * height, 0),
      binaryCols = formattedBinary.match(new RegExp(`.{${height}}`, "g"));
    binaryCols.map((column, colPos) =>
      [...column].map((pixel, pixPos) => {
        ctx.fillStyle = !+pixel ? "transparent" : color; // pixel == 0 ?
        ctx.fillRect(x + marginX + colPos * pixelSize, y + pixPos * pixelSize, pixelSize, pixelSize);
      })
    );
    return charX + (width + 1) * pixelSize;
  }, 0);

// Based on `Pixel Font`: https://github.com/PaulBGD/PixelFont

const font = [
  ...Array(33),

  29, // ! 11101 // " // # // $ // % // &
  ,
  ,
  ,
  ,
  ,
  12, // ' 01100 // ( // ) // *
  ,
  ,
  ,
  "ᇄ", // 4548    + 00100 01110 00100
  3, // 3       , 00011
  "ႄ", // 4228    - 00100 00100 00100
  1, // 1       . 00001
  1118480, // 1118480 / 00001 00010 00100 01000 10000
  "縿", // 32319   0 11111 10001 11111
  31, // 31      1 11111
  "庽", // 24253   2 10111 10101 11101
  "嚿", // 22207   3 10101 10101 11111
  "炟", // 28831   4 11100 00100 11111
  "皷", // 30391   5 11101 10101 10111
  "纷", // 32439   6 11111 10101 10111
  "䈟", // 16927   7 10000 10000 11111
  "线", // 32447   8 11111 10101 11111
  "皿", // 30399   9 11101 10101 11111
  17, // 17      : 10001 // ; // <
  ,
  ,
  "⥊", // = 01010 01010 01010 // >
  ,
  "䊼", // ? 10000 10101 11100 // @
  ,
  "㹏", // 15951  A 01111 10010 01111
  "纮", // 32430  B 11111 10101 01110
  "縱", // 32305   C 11111 10001 10001
  "縮", // 32302   D 11111 10001 01110
  "纵", // 32437   E 11111 10101 10101
  "纐", // 32400   F 11111 10100 10000
  "񴚦", // 476838  G 01110 10001 10101 00110
  "粟", // 31903   H 11111 00100 11111
  "䟱", // 18417   I 10001 11111 10001
  "丿", // 20031   J 10011 10001 11111
  1020241, // 1020241 K 11111 00100 01010 10001
  "簡", // 31777   L 11111 00001 00001
  33059359, // 33059359 M 11111 10000 11100 10000 11111
  1024159, // 1024159 N 11111 01000 00100 11111
  "縿", // 32319   O 11111 10001 11111
  "纜", // 32412   P 11111 10100 11100
  "񼙯", // 509551  Q 01111 10001 10011 01111
  "繍", // 32333   R 11111 10010 01101
  "皷", // 30391   S 11101 10101 10111
  "䏰", // 17392   T 10000 11111 10000
  "簿", // 31807   U 11111 00001 11111
  25363672, // 25363672 V 11000 00110 00001 00110 11000
  32541759, // 32541759 W 11111 00001 00011 00001 11111
  18157905, // 18157905 X 10001 01010 00100 01010 10001
  "惸", // 24824   Y 11000 00111 11000
  18470705, // 18470705 Z 10001 10011 10101 11001 10001 // [ // \ // ] // ^
  ,
  ,
  ,
  ,
  "С" // 1057 _ 00001 00001 00001
  //, // `
  //// #97:
  //, // a
  //,,,,,,,,,,,,,,,,,,,,,,,,,
  //// #123:
  //, // {
  //, // |
  //, // }
  //, // ~
];

const writeLine = initFont(font);
const createText = (value, size, props) => {
    const text = Object.assign(createDisplayObject(size, size, (ctx) => {
        text.width = writeLine(ctx, text.value, 0, 0, text.size, text.color);
    }), {
        color: "#FFF",
        value,
        size
    }, props);
    if (props)
        text.init();
    return text;
};

const getGameObjectComponent = (props) => (Object.assign({ vx: 0, vy: 0, accX: 0, accY: 0 }, props));

const createMovieClip = (tiles, color, isPlaying = false, props) => {
    let ticks = 0;
    let curFrame = 0;
    const framesNum = tiles.length;
    const images = tiles.map((tile) => colorizeImage(assets[tile], color));
    const sprite = createSprite(images[0]);
    const superInit = sprite.init;
    const movie = Object.assign(sprite, {
        outlineSize: 0,
        outlineColor: "#201208" /* Color.BrownDark */,
        playSpeed: 4,
        images,
        color,
        play() {
            isPlaying = true;
        },
        stop(frame = 0) {
            isPlaying = false;
            movie.setImage(movie.images[(curFrame = frame)]);
        },
        init() {
            const mos = movie.outlineSize;
            if (mos > 0) {
                movie.borderSize += mos;
                movie.images = movie.images.map((image) => wrapCanvasFunc(addOutline, image, mos, movie.outlineColor));
                movie.setImage(movie.images[0]);
            }
            else {
                superInit();
            }
        },
        update(dt) {
            if (!isPlaying)
                return;
            ticks++;
            if (ticks % movie.playSpeed === 0) {
                curFrame = (curFrame + 1) % framesNum;
                movie.setImage(movie.images[curFrame]);
            }
        },
        destroy() {
            while (movie.images.length > 0) {
                canvasPool.free(movie.images.pop());
            }
        }
    }, props);
    if (props)
        movie.init();
    return movie;
};

const createEnemy = (tile, color, props) => {
    const enemy = Object.assign(createColoredSprite(tile, color), getGameObjectComponent(), props);
    if (props)
        enemy.init();
    return enemy;
};
const createSnake = () => {
    const snake = Object.assign(createColoredSprite(36 /* Tile.Snake */, "#4dd464" /* Color.Green */), {
        update(dt) {
            if (!snake.target)
                return;
            snake.scaleX = Math.sign(snake.x - snake.target.x);
            // snake.scaleY = 0.9 + Math.sin(time / 100) * 0.1;
        }
    }, {
        pivotX: 0.5,
        pivotY: 1,
        borderSize: ASSETS_BORDER_SIZE
    });
    snake.init();
    return snake;
};
const createGhost = ({ x, y }) => {
    const anim = createMovieClip([39 /* Tile.Ghost */, 40 /* Tile.Ghost1 */], "#bec4bb" /* Color.GreyLight */, true);
    const superUpdate = anim.update;
    const ghost = Object.assign(anim, getGameObjectComponent(), {
        update(dt) {
            // TODO: make animation faster when it's closer to the player
            superUpdate(dt);
            if (!ghost.target)
                return;
            ghost.x += (ghost.target.x - ghost.x) * 0.001;
            ghost.y += (ghost.target.y - ghost.y) * 0.001;
            ghost.scaleX = Math.sign(ghost.x - ghost.target.x);
        }
    }, { x, y, pivotX: 0.5, pivotY: 0.5, borderSize: ASSETS_BORDER_SIZE, playSpeed: 16, outlineSize: ASSETS_OUTLINE_SIZE });
    ghost.init();
    return ghost;
};

const loadImage = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = reject;
});
const wait = (duration = 0) => new Promise((resolve) => {
    setTimeout(resolve, duration);
});
const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};
const padZeros = (count, value) => String(value).padStart(count, "0");
const getRandomElement = (arr) => arr[(Math.random() * arr.length) | 0];
// TODO: add invLerp and move all to Math utils
const remap = (x, a1, a2, b1, b2) => b1 + ((x - a1) * (b2 - b1)) / (a2 - a1);

const createHUD = (width) => {
    let roomNo = 0;
    let coinsCount;
    let sx;
    const height = ASSETS_SCALED_TILE_SIZE;
    const scaledSize = ASSETS_SCALED_ITEM_SIZE;
    const offset = (height - scaledSize) / 2;
    const coinIcon = assets[3 /* Tile.CoinHUD */];
    const color = "#FFF";
    const hud = Object.assign(createDisplayObject(width, height, (context) => {
        writeLine(context, "ROOM " + roomNo, height, offset, scaledSize, color);
        sx = width - 4 * height;
        sx += writeLine(context, coinsCount, sx, offset, scaledSize, color);
        context.drawImage(coinIcon, sx + offset * 2, offset);
    }), {
        setRoomNo(value) {
            roomNo = value;
        },
        setCoinsCount(value) {
            coinsCount = padZeros(3, value);
        }
    });
    hud.setCoinsCount(0);
    return hud;
};

// prettier-ignore
var sfx = [
  [,,1890,0.01,0.02,0.19,,0.45,,,,,0.02,,,,,0.9,0.01], // Coin
  [1.01,,484,,0.03,0.06,1,1.79,18,-2.5,,,,0.3,,,,0.98,0.01], // Jump
  [1.12,,407,.03,.01,.19,4,2.3,,-1.9,,,,1.2,,.3,,.46,.03], // Hit
  [], // Option
];

// Select
// Door
// Win

const playSound = (sound) => zzfx(...sfx[sound]);
const playMusic = async (source) => {
    const buffer = await renderSong(source), node = zzfxP(...buffer);
    node.loop = true;
    zzfxX.resume();
};
const renderSong = async (song) => {
    await wait(50);
    return zzfxM(...song);
};

const createPlayer = (tiles, graveTile, color, props) => {
    let grave;
    let isDead = false;
    const superPlayer = createMovieClip(tiles, color, true);
    const { update: superUpdate, stop: superStop, destroy: superDestroy } = superPlayer;
    const player = Object.assign(superPlayer, getGameObjectComponent(), {
        tile: tiles[0],
        graveTile,
        isAlive() {
            return !isDead;
        },
        die() {
            playSound(2 /* Sound.Hit */);
            isDead = true;
            grave = colorizeImage(assets[graveTile], color);
            grave = wrapCanvasFunc(addOutline, grave, ASSETS_OUTLINE_SIZE, "#201208" /* Color.BrownDark */);
            player.setImage(grave);
            player.accX = player.accY = player.skewX = 0;
        },
        update(dt) {
            if (!isDead) {
                if (player.isOnGround && Math.abs(player.vx) > 0.2) {
                    player.play();
                }
                else {
                    player.stop();
                }
                player.skewX = -remap(Math.abs(player.vx), 0, 5, 0, 0.14);
                superUpdate(dt);
            }
        },
        stop(frame) {
            if (!isDead)
                superStop(frame);
        },
        destroy() {
            if (grave)
                canvasPool.free(grave);
            superDestroy();
        }
    }, props);
    player.init();
    return player;
};

const randomInt = (min, max) => Math.floor(random.nextDouble() * (max - min + 1)) + min;
const quarterСhance = () => randomInt(0, 3) === 0;
const cellIsEmpty = (cell) => (cell === null || cell === void 0 ? void 0 : cell.terrain) === 1 /* TerrainType.Sky */;
// room layout generator
const generateRoom = ({ widthInTiles, heightInTiles, roomNo, numChests = 5 }) => {
    const MAX_HOLES = 3;
    const map = [];
    const itemLocations = [];
    const groundSpawnLocations = [];
    const airSpawnLocations = [];
    const numCells = heightInTiles * widthInTiles;
    const getIndex = (x, y) => x + y * widthInTiles;
    const getCellAt = (px, py) => map[getIndex(px, py)];
    const getCellNear = (c, dx, dy) => map[getIndex(c.x + dx, c.y + dy)];
    const placeItem = (type, locations) => {
        const randIndex = randomInt(0, locations.length - 1), loc = locations[randIndex], leftNeighbor = getCellNear(loc, -1, 0), rightNeighbor = getCellNear(loc, 1, 0);
        locations.splice(randIndex, 1);
        if (leftNeighbor.item || rightNeighbor.item) {
            return placeItem(type, locations);
        }
        loc.item = type;
        return loc;
    };
    const hasEnemy = (cell) => (cell === null || cell === void 0 ? void 0 : cell.item) && (cell.item === 4 /* ItemType.Snake */ || cell.item === 5 /* ItemType.Bat */);
    const placeEnemy = (type, locations) => {
        if (locations.length === 0)
            return undefined;
        const randIndex = randomInt(0, locations.length - 1), loc = locations[randIndex];
        locations.splice(randIndex, 1);
        if (hasEnemy(getCellNear(loc, -1, 0)) ||
            hasEnemy(getCellNear(loc, 1, 0)) ||
            hasEnemy(getCellNear(loc, 0, -1)) ||
            hasEnemy(getCellNear(loc, 0, 1))) {
            return placeEnemy(type, locations);
        }
        loc.item = type;
        return loc;
    };
    const levelThreshold = 8;
    const maxGroundEnemies = Math.floor(roomNo / levelThreshold) + 1;
    const maxFlyingEnemies = Math.floor(roomNo / levelThreshold);
    const groundEnemiesLimit = Math.round(random.nextDouble() * maxGroundEnemies);
    const flyingEnemiesLimit = Math.round(random.nextDouble() * maxFlyingEnemies);
    const busyCells = [];
    let i;
    let cell;
    let holesNum = 0;
    let numEnemies = 0;
    let floor = [];
    if (roomNo === 0) {
        for (i = 0; i < numCells; i++) {
            const x = i % widthInTiles;
            const y = (i / widthInTiles) | 0;
            map.push({
                x,
                y,
                terrain: y === heightInTiles - 1 && x !== 9 ? 2 /* TerrainType.Border */ : 1 /* TerrainType.Sky */
            });
        }
        [
            [2, heightInTiles - 2, 0 /* ItemType.Player */],
            [4, heightInTiles - 2, 1 /* ItemType.Treasure */],
            [5, heightInTiles - 2, 1 /* ItemType.Treasure */],
            [6, heightInTiles - 2, 1 /* ItemType.Treasure */],
            [8, heightInTiles - 2, 1 /* ItemType.Treasure */],
            [widthInTiles - 5, heightInTiles - 3, 2 /* ItemType.Exit */]
        ].forEach(([x, y, itemType]) => (getCellAt(x, y).item = itemType));
        [
            [widthInTiles - 4, heightInTiles - 2, 3 /* TerrainType.Grass */],
            [widthInTiles - 5, heightInTiles - 2, 3 /* TerrainType.Grass */],
            [widthInTiles - 6, heightInTiles - 2, 3 /* TerrainType.Grass */],
            [9, heightInTiles - 5, 0 /* TerrainType.Rock */],
            [10, heightInTiles - 5, 0 /* TerrainType.Rock */]
        ].forEach(([x, y, terrainType]) => (getCellAt(x, y).terrain = terrainType));
        return {
            map,
            itemLocations
        };
    }
    // makeMap
    for (i = 0; i < numCells; i++) {
        map.push({
            x: i % widthInTiles,
            y: (i / widthInTiles) | 0,
            terrain: quarterСhance() ? 0 /* TerrainType.Rock */ : 1 /* TerrainType.Sky */
        });
    }
    // terraformMap
    map.forEach((c) => {
        var _a;
        const cellTwoAbove = getCellNear(c, 0, -2);
        if (c.x === 0 || c.y === 0 || c.x === widthInTiles - 1 || c.y === heightInTiles - 1) {
            if (c.y === heightInTiles - 1) {
                c.terrain = 2 /* TerrainType.Border */;
                floor.push(c);
            }
            else
                c.terrain = 1 /* TerrainType.Sky */;
        }
        else {
            if (c.terrain === 0 /* TerrainType.Rock */) {
                if (((_a = getCellNear(c, 0, -1)) === null || _a === void 0 ? void 0 : _a.terrain) === 1 /* TerrainType.Sky */) {
                    c.terrain = 3 /* TerrainType.Grass */;
                    if (cellTwoAbove) {
                        if (cellTwoAbove.terrain === 0 /* TerrainType.Rock */ || cellTwoAbove.terrain === 3 /* TerrainType.Grass */) {
                            cellTwoAbove.terrain = 1 /* TerrainType.Sky */;
                        }
                    }
                }
            }
        }
    });
    // dig holes in the floor
    floor = floor.filter((c) => {
        if (c.x > 0 && c.x < floor.length - 1) {
            let y;
            let columnCellCount = 0;
            for (y = 0; y < heightInTiles - 1; y++) {
                cell = map[getIndex(c.x, y)];
                if (!cellIsEmpty(cell))
                    columnCellCount++;
            }
            if (columnCellCount < 2)
                return false;
        }
        return true;
    });
    while (floor.length > 3 && holesNum < MAX_HOLES) {
        i = randomInt(1, floor.length - 2);
        cell = floor[i];
        cell.terrain = 1 /* TerrainType.Sky */;
        const cellAbove = map[getIndex(cell.x, cell.y - 1)];
        if (!cellIsEmpty(cellAbove))
            cellAbove.terrain = 1 /* TerrainType.Sky */;
        floor.splice(i - 1, 3);
        holesNum++;
    }
    map.forEach((c) => {
        if (c.y > 1 && c.terrain === 3 /* TerrainType.Grass */) {
            const cellAbove = getCellNear(c, 0, -1);
            itemLocations.push(cellAbove);
        }
    });
    // addItems
    busyCells.push(placeItem(2 /* ItemType.Exit */, itemLocations));
    for (i = 0; i < numChests; i++) {
        busyCells.push(placeItem(1 /* ItemType.Treasure */, itemLocations));
    }
    busyCells.push(placeItem(0 /* ItemType.Player */, itemLocations));
    busyCells.push(placeItem(3 /* ItemType.Portal */, itemLocations));
    map.forEach((c) => {
        if (c.x > 0 &&
            c.x < widthInTiles - 1 &&
            c.y > 1 &&
            (c.terrain === 3 /* TerrainType.Grass */ || c.terrain === 2 /* TerrainType.Border */)) {
            cell = getCellNear(c, 0, -1);
            if (busyCells.indexOf(cell) < 0 &&
                cellIsEmpty(cell) &&
                ((cellIsEmpty(getCellNear(cell, -1, 0)) && !cellIsEmpty(getCellNear(cell, -1, 1))) ||
                    (cellIsEmpty(getCellNear(cell, 1, 0)) && !cellIsEmpty(getCellNear(cell, 1, 1))))) {
                groundSpawnLocations.push(cell);
            }
        }
    });
    while (groundSpawnLocations.length > 0 && numEnemies < groundEnemiesLimit) {
        placeEnemy(4 /* ItemType.Snake */, groundSpawnLocations);
        numEnemies++;
    }
    map.forEach((c) => {
        if (c.x > 0 &&
            c.x < widthInTiles - 1 &&
            cellIsEmpty(c) &&
            cellIsEmpty(getCellNear(c, 0, -1)) &&
            cellIsEmpty(getCellNear(c, 0, 1)) &&
            cellIsEmpty(getCellNear(c, -1, 0)) &&
            cellIsEmpty(getCellNear(c, 1, 0))) {
            airSpawnLocations.push(c);
        }
    });
    numEnemies = 0;
    while (airSpawnLocations.length > 0 && numEnemies < flyingEnemiesLimit) {
        placeEnemy(5 /* ItemType.Bat */, airSpawnLocations);
        numEnemies++;
    }
    return {
        map,
        itemLocations
    };
};

const createToggle = (offTile, onTile, color, onAlpha = 1, props) => {
    let state = 0 /* ToggleState.Off */;
    const toggle = Object.assign(createMovieClip([offTile, onTile], color, false), {
        isOff() {
            return state === 0 /* ToggleState.Off */;
        },
        isOn() {
            return state === 1 /* ToggleState.On */;
        },
        turnOn() {
            toggle.setImage(toggle.images[(state = 1 /* ToggleState.On */)]);
            toggle.alpha = onAlpha;
        }
        /*
      turnOff() {
        toggle.setImage(toggle.images[(state = ToggleState.Off)]);
        toggle.alpha = 1;
      }
      */
    }, props);
    if (props)
        toggle.init();
    return toggle;
};

const destroyMany = (list) => {
    while (list && list.length > 0) {
        list.pop().destroy();
    }
};
const createGameScreen = (game) => {
    let platforms;
    let treasures;
    let snakes;
    let bats;
    let drops;
    let exit;
    let player;
    let portal;
    let lastGrave;
    let ghost;
    let time;
    let room = 0;
    let coins = 0;
    let lastRoomSeed = -1;
    let inTransition = false;
    const { stage } = game;
    const tileSize = ASSETS_SCALED_TILE_SIZE;
    const borderSize = ASSETS_BORDER_SIZE;
    const outlineSize = ASSETS_OUTLINE_SIZE;
    const hud = createHUD(stage.width);
    const blank = createRectShape(stage.width, stage.height, { color: "#201208" /* Color.BrownDark */ });
    const winLabel = createText("YOU WIN!", tileSize * 2, { color: "#f3e2b1" /* Color.Beige */ });
    const states = [];
    const playerColors = ["#f3e2b1" /* Color.Beige */, "#639bff" /* Color.BlueBright */, "#35b23a" /* Color.GreenBright */, "#ff880b" /* Color.Orange */, "#e05ad1" /* Color.Purple */, "#ff5036" /* Color.Red */];
    const playerTiles = [18 /* Tile.Hero */, 21 /* Tile.Knight */, 24 /* Tile.Batman */];
    const playerGraves = [30 /* Tile.Grave */, 31 /* Tile.Grave1 */, 32 /* Tile.Grave2 */];
    const initLevel = (playerColor = "#e05ad1" /* Color.Purple */, playerTile = 18 /* Tile.Hero */, playerGraveTile = 30 /* Tile.Grave */, roomNo = 0) => {
        if (stage.hasChildren())
            stage.removeAll();
        destroyMany(platforms);
        destroyMany(treasures);
        destroyMany(snakes);
        destroyMany(bats);
        if (lastGrave)
            lastGrave.destroy();
        if (portal)
            portal.destroy();
        if (ghost)
            ghost.destroy();
        if (player)
            player.destroy();
        platforms = [];
        treasures = [];
        snakes = [];
        bats = [];
        drops = [];
        time = 0;
        lastGrave = portal = ghost = undefined;
        if (roomNo in states) {
            const state = states[roomNo];
            random.seed = state.seed;
            lastGrave = createColoredSprite(state.graveTile, state.color, {
                x: state.x,
                y: state.y,
                borderSize,
                outlineSize
            });
            ghost = createGhost(state);
        }
        else {
            random.seed = Math.floor(Math.random() * 2147483646);
        }
        lastRoomSeed = random.seed;
        const room = generateRoom({
            widthInTiles: stage.width / tileSize,
            heightInTiles: stage.height / tileSize,
            roomNo
        });
        room.map.forEach((cell) => {
            if (cell.terrain === 1 /* TerrainType.Sky */)
                return;
            let sprite;
            switch (cell.terrain) {
                case 0 /* TerrainType.Rock */:
                    sprite = createColoredSprite(2 /* Tile.Wall2 */, "#cc8e4c" /* Color.BrownLight */);
                    break;
                case 3 /* TerrainType.Grass */:
                    sprite = createColoredSprite(1 /* Tile.Wall1 */, "#a26134" /* Color.Brown */);
                    break;
                case 2 /* TerrainType.Border */:
                    sprite = createColoredSprite(0 /* Tile.Wall */, "#929992" /* Color.Grey */);
                    break;
            }
            sprite.x = cell.x * tileSize;
            sprite.y = cell.y * tileSize;
            platforms.push(sprite);
        });
        room.map.forEach((cell) => {
            if (cell.item !== undefined) {
                let chest, enemy, sprite;
                switch (cell.item) {
                    case 0 /* ItemType.Player */:
                        sprite = player = createPlayer([playerTile, playerTile + 1, playerTile, playerTile + 2], playerGraveTile, playerColor, {
                            scaleX: -1,
                            pivotX: 0.5,
                            pivotY: 0.5,
                            borderSize,
                            frictionX: 1,
                            frictionY: 1,
                            gravity: 0.3,
                            jumpForce: -6.8,
                            isOnGround: true,
                            outlineSize
                        });
                        break;
                    case 1 /* ItemType.Treasure */:
                        chest = sprite = createToggle(14 /* Tile.ChestClosed */, 15 /* Tile.ChestOpened */, "#f7c439" /* Color.Gold */, 0.4);
                        treasures.push(chest);
                        break;
                    case 2 /* ItemType.Exit */:
                        exit = sprite = createToggle(12 /* Tile.DoorClosed */, 13 /* Tile.DoorOpened */, "#ae3737" /* Color.Blood */);
                        exit.turnOn();
                        break;
                    case 3 /* ItemType.Portal */:
                        portal = sprite = createColoredSprite(35 /* Tile.Vortex */, "#5fb7f3" /* Color.Blue */, {
                            pivotX: 0.5,
                            pivotY: 0.5,
                            borderSize
                        });
                        break;
                    case 4 /* ItemType.Snake */:
                        snakes.push((sprite = createSnake()));
                        break;
                    case 5 /* ItemType.Bat */:
                        enemy = sprite = createEnemy(37 /* Tile.Bat */, "#929992" /* Color.Grey */, {
                            pivotX: 0.5,
                            vx: 1,
                            scaleX: -1
                        });
                        bats.push(enemy);
                        break;
                }
                sprite.x = cell.x * tileSize + (tileSize - sprite.width) / 2;
                sprite.y = cell.y * tileSize + (tileSize - sprite.height);
            }
        });
        if (roomNo === 0) {
            drops = [1 /* DropType.Key */, 0 /* DropType.Coin */, 0 /* DropType.Coin */, 0 /* DropType.Coin */];
        }
        else {
            drops = new Array(treasures.length - 1).fill(0 /* DropType.Coin */);
            if (Math.random() < 0.1)
                drops[0] = 2 /* DropType.Magic */;
            drops.push(1 /* DropType.Key */);
            shuffle(drops);
        }
        if (ghost)
            ghost.target = player;
        snakes.forEach((snake) => (snake.target = player));
        stage.addMany(hud, ...platforms, ...treasures, exit, ...snakes, ...bats, lastGrave, ghost, player);
    };
    const resetLevel = () => {
        hud.setRoomNo((room = 0));
        hud.setCoinsCount((coins = 0));
        initLevel(getRandomElement(playerColors), getRandomElement(playerTiles), getRandomElement(playerGraves));
    };
    const endLevel = () => {
        inTransition = true;
        wait(500).then(() => {
            stage.addChild(blank);
            tweenProp(30, (blank.alpha = 0), 1, smoothstep, (a) => {
                blank.alpha = a;
            }, () => {
                if (room > 0)
                    states[room] = {
                        coins,
                        color: player.color,
                        seed: lastRoomSeed,
                        x: player.x,
                        y: player.y,
                        graveTile: player.graveTile
                    };
                resetLevel();
                inTransition = false;
                stage.addChild(blank);
                tweenProp(30, (blank.alpha = 1), 0, smoothstep, (a) => (blank.alpha = a));
            });
        });
    };
    const gameOver = () => {
        // Fade in
        stage.addChild(blank);
        stage.addChild(winLabel);
        winLabel.y = (stage.height - winLabel.height) / 2;
        tweenProp(45, (blank.alpha = winLabel.alpha = 0), 1, smoothstep, (a) => {
            blank.alpha = winLabel.alpha = a;
            winLabel.x = (stage.width - winLabel.width) / 2;
        }, () => {
            destroy();
            game.changeScreen(2 /* ScreenName.HighScores */, coins, player.color);
        });
    };
    const destroy = () => {
        stage.removeAll();
        platforms = [];
        treasures = [];
        drops = [];
        snakes = [];
        bats = [];
    };
    initLevel(getRandomElement(playerColors), getRandomElement(playerTiles), getRandomElement(playerGraves));
    // Fade out
    stage.addChild(blank);
    tweenProp(45, 1, 0, smoothstep, (a) => (blank.alpha = a), () => stage.removeChild(blank));
    const keyR = bindKey(82);
    keyR.release = resetLevel;
    return (dt) => {
        if (inTransition)
            return;
        time += dt;
        if (portal && portal.stage) {
            portal.rotation += Math.PI / 90;
            portal.scaleX = portal.scaleY = 1 + Math.sin(time) * 0.5;
            if (player.stage && hitTestRectangle(player, portal)) {
                stage.removeChild(player);
                gameOver();
            }
        }
        if (!player.stage)
            return;
        // controls
        if (player.isAlive()) {
            if (isLeftKeyDown) {
                player.accX = -0.2;
                player.scaleX = 1;
            }
            else if (isRightKeyDown) {
                player.accX = 0.2;
                player.scaleX = -1;
            }
            else {
                player.accX = 0;
            }
            if (isSpaceDown) {
                if (player.isOnGround) {
                    playSound(1 /* Sound.Jump */);
                    player.vy += player.jumpForce;
                    player.isOnGround = false;
                    player.frictionX = 1;
                }
            }
        }
        if (player.isOnGround) {
            player.frictionX = 0.92;
        }
        else {
            player.frictionX = 0.97;
        }
        player.vx += player.accX;
        player.vy += player.accY;
        player.vx *= player.frictionX;
        player.vy += player.gravity;
        player.x += player.vx;
        player.y += player.vy;
        // collision
        platforms.forEach((platform) => {
            const collision = rectangleCollision(player, platform);
            if (collision !== undefined) {
                switch (collision) {
                    case 1 /* CollisionSide.Bottom */:
                        if (player.vy >= 0) {
                            player.isOnGround = true;
                            player.vy = -player.gravity;
                        }
                        break;
                    case 0 /* CollisionSide.Top */:
                        if (player.vy <= 0)
                            player.vy = 0;
                        break;
                    case 3 /* CollisionSide.Right */:
                        if (player.vx >= 0)
                            player.vx = 0;
                        break;
                    case 2 /* CollisionSide.Left */:
                        if (player.vx <= 0)
                            player.vx = 0;
                        break;
                }
                if (collision !== 1 /* CollisionSide.Bottom */ && player.vy > 0) {
                    player.isOnGround = false;
                }
            }
        });
        snakes = snakes.filter((snake) => {
            if (rectangleCollision(player, snake, true)) {
                if (player.isAlive())
                    player.die();
                stage.removeChild(snake);
                return false;
            }
            return true;
        });
        // clamp
        if (player.x < tileSize / 2 - player.width)
            player.x = stage.width - tileSize + player.width;
        if (player.x > stage.width - tileSize + player.width)
            player.x = tileSize / 2 - player.width;
        if (player.y + player.height > stage.height)
            player.y = -player.height;
        if (!player.isAlive()) {
            if (Math.abs(player.vx) < 0.01 && Math.abs(player.vy) < 0.01 && player.isOnGround)
                endLevel();
            return;
        }
        if (ghost && rectangleCollision(player, ghost, true))
            player.die();
        if (lastGrave && hitTestRectangle(player, lastGrave)) {
            stage.removeChild(lastGrave);
            stage.removeChild(ghost);
            lastGrave = ghost = undefined;
            hud.setCoinsCount((coins += states[room].coins));
            delete states[room];
            playSound(0 /* Sound.Coin */);
        }
        bats.forEach((bat) => {
            bat.x += bat.vx;
            bat.y = bat.y + Math.sin(time);
            for (const platform of platforms) {
                if (hitTestRectangle(bat, platform)) {
                    bat.vx *= -1;
                    bat.scaleX *= -1;
                    break;
                }
            }
            if (bat.x < 0 || bat.x > stage.width - bat.width) {
                bat.vx *= -1;
                bat.scaleX *= -1;
            }
            if (hitTestRectangle(player, bat))
                player.die();
        });
        // loot
        treasures.forEach((chest) => {
            if (chest.isOff() && hitTestRectangle(player, chest)) {
                hud.setCoinsCount(++coins);
                playSound(0 /* Sound.Coin */);
                const oldChestHeight = chest.height;
                chest.turnOn();
                chest.y -= chest.height - oldChestHeight;
                let loot;
                const drop = drops.pop();
                switch (drop) {
                    case 0 /* DropType.Coin */:
                        // TODO: check pos
                        loot = createMovieClip([6 /* Tile.Coin */, 7 /* Tile.Coin1 */, 8 /* Tile.Coin2 */, 9 /* Tile.Coin3 */], "#f7c439" /* Color.Gold */, true);
                        break;
                    case 1 /* DropType.Key */:
                        loot = createColoredSprite(33 /* Tile.Key */, "#f7c439" /* Color.Gold */, {
                            borderSize
                        });
                        break;
                    case 2 /* DropType.Magic */:
                        loot = createColoredSprite(34 /* Tile.Hat */, "#5fb7f3" /* Color.Blue */, {
                            borderSize
                        });
                        break;
                }
                loot.x = chest.x + (chest.width - loot.width) / 2 + borderSize;
                loot.y = chest.y;
                stage.addChild(loot);
                tweenProp(15, (loot.alpha = 0), 1, easeOutBack, (ratio) => {
                    loot.y = chest.y - (tileSize / 2 + chest.height) * ratio;
                    loot.alpha = ratio;
                }, () => {
                    loot.y = chest.y - (tileSize / 2 + chest.height);
                    loot.alpha = 1;
                    wait(350).then(() => {
                        tweenProp(15, (loot.alpha = 1), 0, sine, (ratio) => {
                            loot.alpha = ratio;
                        }, () => {
                            loot.alpha = 0;
                            if (loot.stage) {
                                stage.removeChild(loot);
                                loot.destroy();
                            }
                        });
                    });
                });
                if (drop === 1 /* DropType.Key */)
                    exit.turnOn();
                else if (drop === 2 /* DropType.Magic */) {
                    if (portal && !portal.stage)
                        stage.addChild(portal);
                }
            }
        });
        if (exit.isOn() && hitTestRectangle(player, exit)) {
            hud.setRoomNo(++room);
            initLevel(player.color, player.tile, player.graveTile, room);
        }
    };
};

const STORAGE_KEY = "enchanted_dungeon_scores";
const MAX_RECORDS_LEN = 100;
let records = [];
const createHighScoresScreen = (game, score, color) => {
    const tileSize = ASSETS_SCALED_TILE_SIZE;
    const textSize = ASSETS_SCALED_ITEM_SIZE;
    const { stage } = game;
    const title = createText("HIGH SCORES", tileSize, { y: tileSize, color: "#f3e2b1" /* Color.Beige */ });
    const candleLeft = createColoredSprite(4 /* Tile.Candle */, "#ff880b" /* Color.Orange */, { y: tileSize });
    const candleRight = createColoredSprite(4 /* Tile.Candle */, "#ff880b" /* Color.Orange */, { y: tileSize, pivotX: 0.5, scaleX: -1 });
    const backLabel = createText("ANY KEY", tileSize / 2, { y: stage.height - tileSize * 1.5 });
    const blank = createRectShape(stage.width, stage.height, { color: "#201208" /* Color.BrownDark */ });
    const keyUpHandler = (event) => {
        removeEventListener("keyup", keyUpHandler);
        // Fade in
        tweenProp(45, 0, 1, smoothstep, (a) => (blank.alpha = a), () => {
            stage.removeAll();
            game.changeScreen(0 /* ScreenName.Start */);
        });
    };
    let i;
    let t = 0;
    if (score > 0) {
        const name = prompt("Please, enter your name (8 chars max):", "Player 1");
        wait(500).then(() => unlockAudio(true));
        if (name)
            records.push([score, name.substring(0, 8), color]);
    }
    records.sort((a, b) => b[0] - a[0]);
    saveRecords();
    for (i = 0; i < Math.min(records.length, 6); i++) {
        const [score, name, color] = records[i];
        const y = tileSize * 3 + i * textSize * 1.5;
        const offX = tileSize / 2;
        const screenWidth = stage.width - tileSize;
        const posLabel = createText(padZeros(2, i + 1), textSize, {
            x: offX + (screenWidth / 10) * 2,
            y,
            color
        });
        const scoreLabel = createText(padZeros(7, score), textSize, {
            x: offX + (screenWidth / 10) * 3,
            y,
            color
        });
        const nameLabel = createText(name.toUpperCase(), textSize, {
            x: offX + (screenWidth / 10) * 6,
            y,
            color
        });
        stage.addMany(posLabel, scoreLabel, nameLabel);
    }
    stage.addMany(title, candleLeft, candleRight, backLabel, blank);
    // Fade out
    tweenProp(45, 1, 0, smoothstep, (a) => (blank.alpha = a), () => (blank.alpha = 0));
    addEventListener("keyup", keyUpHandler);
    return () => {
        title.x = (stage.width - title.width) / 2;
        candleLeft.x = title.x - candleLeft.width;
        candleRight.x = title.x + title.width + 5; // add char size
        backLabel.x = (stage.width - backLabel.width) / 2;
        if (t++ % 40 === 0)
            backLabel.alpha = backLabel.alpha === 0 ? 1 : 0;
    };
};
const loadRecords = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw)
        records = JSON.parse(raw);
};
const saveRecords = () => {
    if (records.length > MAX_RECORDS_LEN)
        records.length = MAX_RECORDS_LEN;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

const createStartScreen = (game) => {
    const { stage } = game;
    const tileSize = ASSETS_SCALED_TILE_SIZE;
    const textSize = ASSETS_SCALED_ITEM_SIZE;
    const titleLine1 = createText("ENCHANTED", tileSize * 2, { y: tileSize * 2, color: "#f3e2b1" /* Color.Beige */ });
    const titleLine2 = createText("DUNGEON", tileSize * 2, { y: tileSize * 5, color: "#f3e2b1" /* Color.Beige */ });
    const start = createText("START", textSize, { y: stage.height - tileSize * 4 });
    const score = createText("SCORES", textSize, { y: stage.height - tileSize * 3 + 5 });
    const scull = createColoredSprite(5 /* Tile.Scull */, "#ff5036" /* Color.Red */, { y: start.y });
    const blank = createRectShape(stage.width, stage.height, { color: "#201208" /* Color.BrownDark */ });
    const menu = [start.y, score.y];
    const keyUpHandler = (event) => {
        const { keyCode } = event;
        if (keyCode === KEY_UP || keyCode === KEY_DOWN || keyCode === KEY_LEFT || keyCode === KEY_RIGHT) {
            selection = (selection + 1) % menu.length;
            playSound(3 /* Sound.Option */);
        }
        else if (keyCode === SPACE || keyCode === ENTER) {
            removeEventListener("keyup", keyUpHandler);
            tweenProp(30, (blank.alpha = 0), 1, smoothstep, (x) => (blank.alpha = x), () => {
                stage.removeAll();
                if (selection === 0 /* MenuItem.Start */)
                    game.changeScreen(1 /* ScreenName.Game */);
                else
                    game.changeScreen(2 /* ScreenName.HighScores */);
            });
        }
    };
    let selection = 0;
    stage.addMany(titleLine1, titleLine2, start, score, scull, blank);
    // Fade out
    tweenProp(30, 1, 0, smoothstep, (a) => (blank.alpha = a), () => (blank.alpha = 0));
    addEventListener("keyup", keyUpHandler);
    return () => {
        titleLine1.x = (stage.width - titleLine1.width) / 2;
        titleLine2.x = (stage.width - titleLine2.width) / 2;
        start.x = score.x = (stage.width - start.width) / 2;
        scull.x = start.x - scull.width - 10;
        scull.y = menu[selection];
    };
};

const createGame = (canvas) => {
    let updateScreen;
    const context = canvas.getContext("2d");
    const tileSize = ASSETS_SCALED_TILE_SIZE;
    const stage = createStage(canvas.width + tileSize, canvas.height, { x: -tileSize / 2 });
    const game = {
        stage,
        update(dt) {
            stage.update(dt);
            updateScreen(dt);
            updateTweens();
        },
        render() {
            context.fillStyle = "#201208" /* Color.BrownDark */;
            context.fillRect(0, 0, stage.width, stage.height);
            stage.render(context);
        },
        changeScreen(name, ...params) {
            var _a, _b;
            let score, color;
            switch (name) {
                case 0 /* ScreenName.Start */:
                    updateScreen = createStartScreen(game);
                    break;
                case 1 /* ScreenName.Game */:
                    updateScreen = createGameScreen(game);
                    break;
                case 2 /* ScreenName.HighScores */:
                    score = (_a = params[0]) !== null && _a !== void 0 ? _a : -1;
                    color = (_b = params[1]) !== null && _b !== void 0 ? _b : "white" /* Color.White */;
                    updateScreen = createHighScoresScreen(game, score, color);
                    break;
            }
        }
    };
    game.changeScreen(0 /* ScreenName.Start */);
    return game;
};

const main = async () => {
    initAssets(await loadImage(ATLAS_URL));
    loadRecords();
    playMusic(DEATH_DROP);
    let now;
    let dt;
    let last = 0;
    let focused = true;
    onfocus = () => (focused = true);
    onblur = () => (focused = false);
    const game = createGame(g);
    const render = initRenderer(g);
    const loop = (t) => {
        requestAnimationFrame(loop);
        if (!focused)
            return;
        now = performance.now();
        dt = now - last;
        last = now;
        game.update(dt);
        game.render();
        render(t);
    };
    loop(0);
};
main();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY29yZS9jYW52YXMtdXRpbHMudHMiLCIuLi9zcmMvYXNzZXRzLnRzIiwiLi4vc3JjL2Fzc2V0cy9hLnBuZyIsIi4uL3NyYy9hc3NldHMvZGVhdGgtZHJvcC5qcyIsIi4uL3NyYy9jb3JlL3JlbmRlcmVyLnRzIiwiLi4vc3JjL2NvcmUvZGlzcGxheS50cyIsIi4uL3NyYy9jb3JlL3N0YWdlLnRzIiwiLi4vc3JjL2NvcmUvdHdlZW4udHMiLCIuLi9zcmMvY29yZS9zcHJpdGUudHMiLCIuLi9zcmMvY29sb3JlZC1zcHJpdGUudHMiLCIuLi9zcmMvY29yZS9jb2xsaXNpb24udHMiLCIuLi9zcmMvY29yZS9zb3VuZC96emZ4LmpzIiwiLi4vc3JjL2NvcmUvc291bmQvYXVkaW8udHMiLCIuLi9zcmMvY29yZS9rZXlib2FyZC50cyIsIi4uL3NyYy9jb3JlL3JhbmRvbS50cyIsIi4uL3NyYy9jb3JlL3NoYXBlLnRzIiwiLi4vc3JjL2NvcmUvZm9udC9pbmRleC5qcyIsIi4uL3NyYy9jb3JlL2ZvbnQvcGl4ZWwuanMiLCIuLi9zcmMvY29yZS90ZXh0LnRzIiwiLi4vc3JjL2NvcmUvZ2FtZS1vYmplY3QudHMiLCIuLi9zcmMvbW92aWUtY2xpcC50cyIsIi4uL3NyYy9lbmVteS50cyIsIi4uL3NyYy91dGlscy50cyIsIi4uL3NyYy9odWQudHMiLCIuLi9zcmMvYXNzZXRzL3NmeC5qcyIsIi4uL3NyYy9zb3VuZHMudHMiLCIuLi9zcmMvcGxheWVyLnRzIiwiLi4vc3JjL3Jvb20udHMiLCIuLi9zcmMvdG9nZ2xlLnRzIiwiLi4vc3JjL3NjcmVlbnMvZ2FtZS1zY3JlZW4udHMiLCIuLi9zcmMvc2NyZWVucy9zY29yZS1zY3JlZW4udHMiLCIuLi9zcmMvc2NyZWVucy9zdGFydC1zY3JlZW4udHMiLCIuLi9zcmMvZ2FtZS50cyIsIi4uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUYWlsIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLy8gVE9ETzogbW92ZSB0byBvdGhlciB1dGlsc1xuY29uc3QgY3JlYXRlT2JqZWN0UG9vbCA9IDxUPihjcmVhdGU6ICgpID0+IFQsIHJlc2V0PzogKG9iajogVCkgPT4gdm9pZCkgPT4ge1xuICBjb25zdCBvYmplY3RzOiBBcnJheTxUPiA9IFtdO1xuICBsZXQgYWxsb2NDb3VudCA9IDA7XG4gIGxldCBmcmVlQ291bnQgPSAwO1xuICByZXR1cm4ge1xuICAgIGZyZWUob2JqOiBUKSB7XG4gICAgICBpZiAocmVzZXQpIHJlc2V0KG9iaik7XG4gICAgICBmcmVlQ291bnQrKztcbiAgICAgIG9iamVjdHMucHVzaChvYmopO1xuICAgIH0sXG4gICAgYWxsb2MoKTogVCB7XG4gICAgICBpZiAob2JqZWN0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiBvYmplY3RzLnBvcCgpITtcbiAgICAgIH1cbiAgICAgIGFsbG9jQ291bnQrKztcbiAgICAgIHJldHVybiBjcmVhdGUoKTtcbiAgICB9LFxuICAgIGdldFNpemUoKSB7XG4gICAgICByZXR1cm4gb2JqZWN0cy5sZW5ndGg7XG4gICAgfSxcbiAgICBkaXNwb3NlKCkge1xuICAgICAgb2JqZWN0cy5sZW5ndGggPSAwO1xuICAgIH1cbiAgfTtcbn07XG5cbmNvbnN0IGNhbnZhc1Bvb2wgPSBjcmVhdGVPYmplY3RQb29sKFxuICAoKSA9PiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpLFxuICAoY2FudmFzKSA9PiB7XG4gICAgY29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuICAgIGNvbnRleHQuY2xlYXJSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gIH1cbik7XG5cbmNvbnN0IHdyYXBDYW52YXNGdW5jID0gPFxuICBUIGV4dGVuZHMgKFxuICAgIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQsXG4gICAgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsXG4gICAgc3JjOiBIVE1MQ2FudmFzRWxlbWVudCxcbiAgICAuLi5yZXN0OiBhbnlbXVxuICApID0+IEhUTUxDYW52YXNFbGVtZW50LFxuICBLIGV4dGVuZHMgVGFpbDxUYWlsPFBhcmFtZXRlcnM8VD4+PlxuPihcbiAgZnVuYzogVCxcbiAgc291cmNlOiBIVE1MQ2FudmFzRWxlbWVudCxcbiAgLi4ucmVzdDogVGFpbDxLPlxuKSA9PiB7XG4gIGNvbnN0IGNhbnZhcyA9IGNhbnZhc1Bvb2wuYWxsb2MoKTtcbiAgY29uc3QgZGVzdCA9IGZ1bmMoY2FudmFzLCBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpISwgc291cmNlLCAuLi5yZXN0KTtcbiAgY2FudmFzUG9vbC5mcmVlKHNvdXJjZSk7XG4gIHJldHVybiBkZXN0O1xufTtcblxuY29uc3QgY29sb3JpemVJbWFnZSA9IChcbiAgaW1hZ2U6IENhbnZhc0ltYWdlU291cmNlLFxuICBjb2xvcjogc3RyaW5nLFxuICBjYW52YXMgPSBjYW52YXNQb29sLmFsbG9jKCksXG4gIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpIVxuKTogSFRNTENhbnZhc0VsZW1lbnQgPT4ge1xuICBjYW52YXMud2lkdGggPSA8bnVtYmVyPmltYWdlLndpZHRoO1xuICBjYW52YXMuaGVpZ2h0ID0gPG51bWJlcj5pbWFnZS5oZWlnaHQ7XG4gIGNvbnRleHQuZHJhd0ltYWdlKGltYWdlLCAwLCAwKTtcblxuICBjb250ZXh0LmZpbGxTdHlsZSA9IGNvbG9yO1xuICBjb250ZXh0Lmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9IFwic291cmNlLWluXCI7XG4gIGNvbnRleHQuZmlsbFJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcblxuICByZXR1cm4gY2FudmFzO1xufTtcblxuY29uc3QgZHJhd1JlZ2lvbiA9IChcbiAgaW1hZ2U6IENhbnZhc0ltYWdlU291cmNlLFxuICBzeDogbnVtYmVyLFxuICBzeTogbnVtYmVyLFxuICBzdzogbnVtYmVyLFxuICBzaDogbnVtYmVyLFxuICBkeCA9IDAsXG4gIGR5ID0gMCxcbiAgY2FudmFzID0gY2FudmFzUG9vbC5hbGxvYygpLFxuICBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKSFcbik6IEhUTUxDYW52YXNFbGVtZW50ID0+IHtcbiAgY2FudmFzLndpZHRoID0gc3c7XG4gIGNhbnZhcy5oZWlnaHQgPSBzaDtcbiAgY29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UsIHN4LCBzeSwgc3csIHNoLCBkeCwgZHksIHN3LCBzaCk7XG4gIHJldHVybiBjYW52YXM7XG59O1xuXG5jb25zdCBhZGRPdXRsaW5lID0gKFxuICBjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50LFxuICBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKSEsXG4gIGltYWdlOiBDYW52YXNJbWFnZVNvdXJjZSxcbiAgc2l6ZTogbnVtYmVyLFxuICBjb2xvcjogc3RyaW5nXG4pID0+IHtcbiAgY2FudmFzLndpZHRoID0gPG51bWJlcj5pbWFnZS53aWR0aCArIHNpemUgKiAyO1xuICBjYW52YXMuaGVpZ2h0ID0gPG51bWJlcj5pbWFnZS5oZWlnaHQgKyBzaXplICogMjtcblxuICBjb25zdCBkQXJyID0gWy0xLCAtMSwgMCwgLTEsIDEsIC0xLCAtMSwgMCwgMSwgMCwgLTEsIDEsIDAsIDEsIDEsIDFdLFxuICAgIHMgPSBzaXplLFxuICAgIHggPSBzaXplLFxuICAgIHkgPSBzaXplO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZEFyci5sZW5ndGg7IGkgKz0gMikgY29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UsIHggKyBkQXJyW2ldICogcywgeSArIGRBcnJbaSArIDFdICogcyk7XG5cbiAgY29udGV4dC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSBcInNvdXJjZS1pblwiO1xuICBjb250ZXh0LmZpbGxTdHlsZSA9IGNvbG9yO1xuICBjb250ZXh0LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG5cbiAgY29udGV4dC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSBcInNvdXJjZS1vdmVyXCI7XG4gIGNvbnRleHQuZHJhd0ltYWdlKGltYWdlLCB4LCB5KTtcblxuICByZXR1cm4gY2FudmFzO1xufTtcblxuY29uc3QgZXJhc2VDb2xvciA9IChcbiAgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCxcbiAgY29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuICBpbWFnZTogQ2FudmFzSW1hZ2VTb3VyY2UsXG4gIHIgPSAwLFxuICBnID0gcixcbiAgYiA9IHJcbik6IEhUTUxDYW52YXNFbGVtZW50ID0+IHtcbiAgY2FudmFzLndpZHRoID0gPG51bWJlcj5pbWFnZS53aWR0aDtcbiAgY2FudmFzLmhlaWdodCA9IDxudW1iZXI+aW1hZ2UuaGVpZ2h0O1xuICBjb250ZXh0LmRyYXdJbWFnZShpbWFnZSwgMCwgMCk7XG5cbiAgY29uc3QgaW1nRGF0YSA9IGNvbnRleHQuZ2V0SW1hZ2VEYXRhKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCksXG4gICAgcmdiYSA9IGltZ0RhdGEuZGF0YTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJnYmEubGVuZ3RoOyBpICs9IDQpIHtcbiAgICBpZiAocmdiYVtpXSA9PT0gciAmJiByZ2JhW2kgKyAxXSA9PT0gZyAmJiByZ2JhW2kgKyAyXSA9PT0gYikge1xuICAgICAgcmdiYVtpICsgM10gPSAwO1xuICAgIH1cbiAgfVxuICBjb250ZXh0LnB1dEltYWdlRGF0YShpbWdEYXRhLCAwLCAwKTtcblxuICByZXR1cm4gY2FudmFzO1xufTtcblxuY29uc3QgZ2V0T3BhcXVlQm91bmRzID0gKFxuICBjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50LFxuICBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKSFcbik6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyLCBudW1iZXJdID0+IHtcbiAgY29uc3QgY2FudmFzV2lkdGggPSBjYW52YXMud2lkdGg7XG4gIGNvbnN0IGNhbnZhc0hlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XG4gIGNvbnN0IGltYWdlRGF0YSA9IGNvbnRleHQuZ2V0SW1hZ2VEYXRhKDAsIDAsIGNhbnZhc1dpZHRoLCBjYW52YXNIZWlnaHQpLFxuICAgIHJnYmEgPSBpbWFnZURhdGEuZGF0YTtcblxuICBsZXQgeDogbnVtYmVyLCB5OiBudW1iZXIsIGk6IG51bWJlcjtcbiAgbGV0IG1pblggPSBjYW52YXNXaWR0aCxcbiAgICBtaW5ZID0gY2FudmFzSGVpZ2h0LFxuICAgIG1heFggPSAwLFxuICAgIG1heFkgPSAwO1xuXG4gIGZvciAoeSA9IDA7IHkgPCBjYW52YXNIZWlnaHQ7IHkrKykge1xuICAgIGZvciAoeCA9IDA7IHggPCBjYW52YXNXaWR0aDsgeCsrKSB7XG4gICAgICBpID0gKHggKyB5ICogY2FudmFzV2lkdGgpICogNDtcbiAgICAgIGlmIChyZ2JhW2ldICE9PSAwKSB7XG4gICAgICAgIGlmICh4IDwgbWluWCkgbWluWCA9IHg7XG4gICAgICAgIGlmICh5IDwgbWluWSkgbWluWSA9IHk7XG4gICAgICAgIGlmICh4ID4gbWF4WCkgbWF4WCA9IHg7XG4gICAgICAgIGlmICh5ID4gbWF4WSkgbWF4WSA9IHk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBbbWluWCwgbWluWSwgbWF4WCwgbWF4WV07XG59O1xuXG5jb25zdCBjcm9wQWxwaGEgPSAoXG4gIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQsXG4gIGNvbnRleHQ6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCxcbiAgaW1hZ2U6IENhbnZhc0ltYWdlU291cmNlLFxuICBbbWluWCwgbWluWSwgbWF4WCwgbWF4WV06IFtudW1iZXIsIG51bWJlciwgbnVtYmVyLCBudW1iZXJdXG4pOiBIVE1MQ2FudmFzRWxlbWVudCA9PiB7XG4gIGNhbnZhcy53aWR0aCA9IG1heFggLSBtaW5YICsgMTtcbiAgY2FudmFzLmhlaWdodCA9IG1heFkgLSBtaW5ZICsgMTtcbiAgY29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UsIC1taW5YLCAtbWluWSk7XG4gIHJldHVybiBjYW52YXM7XG59O1xuXG5jb25zdCBzY2FsZVBpeGVsYXRlZCA9IChcbiAgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCxcbiAgY29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuICBpbWFnZTogQ2FudmFzSW1hZ2VTb3VyY2UsXG4gIHNjYWxlWDogbnVtYmVyLFxuICBzY2FsZVkgPSBzY2FsZVhcbikgPT4ge1xuICBjYW52YXMud2lkdGggPSA8bnVtYmVyPmltYWdlLndpZHRoICogc2NhbGVYO1xuICBjYW52YXMuaGVpZ2h0ID0gPG51bWJlcj5pbWFnZS5oZWlnaHQgKiBzY2FsZVk7XG4gIGNvbnRleHQuaW1hZ2VTbW9vdGhpbmdFbmFibGVkID0gZmFsc2U7XG4gIGNvbnRleHQuZHJhd0ltYWdlKGltYWdlLCAwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICByZXR1cm4gY2FudmFzO1xufTtcblxuY29uc3QgYWRkUGFkZGluZyA9IChcbiAgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCxcbiAgY29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuICBpbWFnZTogQ2FudmFzSW1hZ2VTb3VyY2UsXG4gIGJvcmRlcjogbnVtYmVyXG4pID0+IHtcbiAgY2FudmFzLndpZHRoID0gPG51bWJlcj5pbWFnZS53aWR0aCArIGJvcmRlciAqIDI7XG4gIGNhbnZhcy5oZWlnaHQgPSA8bnVtYmVyPmltYWdlLmhlaWdodCArIGJvcmRlciAqIDI7XG4gIGNvbnRleHQuZHJhd0ltYWdlKGltYWdlLCBib3JkZXIsIGJvcmRlcik7XG4gIHJldHVybiBjYW52YXM7XG59O1xuXG5leHBvcnQge1xuICBjYW52YXNQb29sLFxuICBhZGRQYWRkaW5nLFxuICBjb2xvcml6ZUltYWdlLFxuICBhZGRPdXRsaW5lLFxuICBjcm9wQWxwaGEsXG4gIGRyYXdSZWdpb24sXG4gIGVyYXNlQ29sb3IsXG4gIGdldE9wYXF1ZUJvdW5kcyxcbiAgc2NhbGVQaXhlbGF0ZWQsXG4gIHdyYXBDYW52YXNGdW5jXG59O1xuIiwiaW1wb3J0IHtcbiAgYWRkUGFkZGluZyxcbiAgY3JvcEFscGhhLFxuICBkcmF3UmVnaW9uLFxuICBlcmFzZUNvbG9yLFxuICBnZXRPcGFxdWVCb3VuZHMsXG4gIHNjYWxlUGl4ZWxhdGVkLFxuICB3cmFwQ2FudmFzRnVuY1xufSBmcm9tIFwiLi9jb3JlL2NhbnZhcy11dGlsc1wiO1xuXG5jb25zdCBlbnVtIFRpbGUge1xuICBXYWxsLFxuICBXYWxsMSxcbiAgV2FsbDIsXG4gIENvaW5IVUQsXG4gIENhbmRsZSxcbiAgU2N1bGwsXG5cbiAgQ29pbixcbiAgQ29pbjEsXG4gIENvaW4yLFxuICBDb2luMyxcbiAgRW1wdHksXG4gIEVtcHR5MSxcblxuICBEb29yQ2xvc2VkLFxuICBEb29yT3BlbmVkLFxuICBDaGVzdENsb3NlZCxcbiAgQ2hlc3RPcGVuZWQsXG4gIEVtcHR5MixcbiAgRW1wdHkzLFxuXG4gIEhlcm8sXG4gIEhlcm8xLFxuICBIZXJvMixcbiAgS25pZ2h0LFxuICBLbmlnaHQxLFxuICBLbmlnaHQyLFxuXG4gIEJhdG1hbixcbiAgQmF0bWFuMSxcbiAgQmF0bWFuMixcbiAgRW1wdHk0LFxuICBFbXB0eTUsXG4gIEVtcHR5NixcblxuICBHcmF2ZSxcbiAgR3JhdmUxLFxuICBHcmF2ZTIsXG4gIEtleSxcbiAgSGF0LFxuICBWb3J0ZXgsXG5cbiAgU25ha2UsXG4gIEJhdCxcbiAgU3BpZGVyLFxuICBHaG9zdCxcbiAgR2hvc3QxLFxuICBFbXB0eTdcbn1cblxuY29uc3QgQVNTRVRTX1RJTEVfU0laRSA9IDEwO1xuY29uc3QgQVNTRVRTX1RJTEVfU0NBTEUgPSA0O1xuY29uc3QgQVNTRVRTX0lURU1fU0NBTEUgPSAzO1xuY29uc3QgQVNTRVRTX0JPUkRFUl9TSVpFID0gMjtcbmNvbnN0IEFTU0VUU19PVVRMSU5FX1NJWkUgPSAyO1xuY29uc3QgQVNTRVRTX1NDQUxFRF9USUxFX1NJWkUgPSBBU1NFVFNfVElMRV9TSVpFICogQVNTRVRTX1RJTEVfU0NBTEU7XG5jb25zdCBBU1NFVFNfU0NBTEVEX0lURU1fU0laRSA9IEFTU0VUU19USUxFX1NJWkUgKiBBU1NFVFNfSVRFTV9TQ0FMRTtcbmNvbnN0IEdST1VQX0NST1AgPSBUaWxlLkRvb3JDbG9zZWQ7XG5jb25zdCBHUk9VUF9BRERfQk9SREVSID0gVGlsZS5IZXJvO1xuXG5jb25zdCBwcm9jZXNzVGlsZSA9IChcbiAgaW1hZ2U6IEhUTUxJbWFnZUVsZW1lbnQsXG4gIG9mZlg6IG51bWJlcixcbiAgb2ZmWTogbnVtYmVyLFxuICBzaXplOiBudW1iZXIsXG4gIHNjYWxlOiBudW1iZXIsXG4gIGRvQ3JvcCA9IHRydWUsXG4gIGJvcmRlclNpemUgPSAwXG4pOiBIVE1MQ2FudmFzRWxlbWVudCA9PiB7XG4gIGxldCBjYW52YXMgPSBkcmF3UmVnaW9uKGltYWdlLCBvZmZYLCBvZmZZLCBzaXplLCBzaXplKTtcbiAgY2FudmFzID0gd3JhcENhbnZhc0Z1bmMoZXJhc2VDb2xvciwgY2FudmFzKTtcbiAgaWYgKGRvQ3JvcCkge1xuICAgIGNhbnZhcyA9IHdyYXBDYW52YXNGdW5jKGNyb3BBbHBoYSwgY2FudmFzLCBnZXRPcGFxdWVCb3VuZHMoY2FudmFzKSk7XG4gIH1cbiAgY2FudmFzID0gd3JhcENhbnZhc0Z1bmMoc2NhbGVQaXhlbGF0ZWQsIGNhbnZhcywgc2NhbGUpO1xuICBpZiAoYm9yZGVyU2l6ZSA+IDApIGNhbnZhcyA9IHdyYXBDYW52YXNGdW5jKGFkZFBhZGRpbmcsIGNhbnZhcywgYm9yZGVyU2l6ZSk7XG4gIHJldHVybiBjYW52YXM7XG59O1xuXG5jb25zdCBhc3NldHM6IEFycmF5PEhUTUxDYW52YXNFbGVtZW50PiA9IFtdO1xuXG5jb25zdCBpbml0QXNzZXRzID0gKGF0bGFzOiBIVE1MSW1hZ2VFbGVtZW50KSA9PiB7XG4gIGNvbnN0IHJvd3MgPSBhdGxhcy53aWR0aCAvIEFTU0VUU19USUxFX1NJWkU7XG4gIGNvbnN0IGNvbHMgPSBhdGxhcy5oZWlnaHQgLyBBU1NFVFNfVElMRV9TSVpFO1xuICBjb25zdCBzY2FsZXMgPSBuZXcgQXJyYXkocm93cyAqIGNvbHMpLmZpbGwoQVNTRVRTX0lURU1fU0NBTEUpO1xuXG4gIGZvciAobGV0IGkgPSBUaWxlLldhbGw7IGkgPD0gVGlsZS5DYW5kbGU7IGkrKykge1xuICAgIHNjYWxlc1tpXSA9IEFTU0VUU19USUxFX1NDQUxFO1xuICB9XG4gIHNjYWxlc1tUaWxlLkNvaW5IVURdID0gNTtcblxuICBsZXQgeDogbnVtYmVyLCB5OiBudW1iZXIsIGk6IG51bWJlcjtcbiAgZm9yICh5ID0gMDsgeSA8IGNvbHM7IHkrKykge1xuICAgIGZvciAoeCA9IDA7IHggPCByb3dzOyB4KyspIHtcbiAgICAgIGkgPSB4ICsgeSAqIHJvd3M7XG4gICAgICBhc3NldHNbaV0gPSBwcm9jZXNzVGlsZShcbiAgICAgICAgYXRsYXMsXG4gICAgICAgIHggKiBBU1NFVFNfVElMRV9TSVpFLFxuICAgICAgICB5ICogQVNTRVRTX1RJTEVfU0laRSxcbiAgICAgICAgQVNTRVRTX1RJTEVfU0laRSxcbiAgICAgICAgc2NhbGVzW2ldLFxuICAgICAgICBpID49IEdST1VQX0NST1AsXG4gICAgICAgIGkgPCBHUk9VUF9BRERfQk9SREVSID8gMCA6IEFTU0VUU19CT1JERVJfU0laRVxuICAgICAgKTtcbiAgICB9XG4gIH1cbn07XG5cbmV4cG9ydCB7XG4gIFRpbGUsXG4gIEFTU0VUU19USUxFX1NJWkUsXG4gIEFTU0VUU19USUxFX1NDQUxFLFxuICBBU1NFVFNfSVRFTV9TQ0FMRSxcbiAgQVNTRVRTX0JPUkRFUl9TSVpFLFxuICBBU1NFVFNfT1VUTElORV9TSVpFLFxuICBBU1NFVFNfU0NBTEVEX1RJTEVfU0laRSxcbiAgQVNTRVRTX1NDQUxFRF9JVEVNX1NJWkUsXG4gIGFzc2V0cyxcbiAgaW5pdEFzc2V0c1xufTtcbiIsImV4cG9ydCBkZWZhdWx0IFwiYXNzZXRzL2EucG5nXCIiLCJleHBvcnQgZGVmYXVsdCBbW1suMywwLDI5LCwuMDcsLjIsMyw2LCwsLC4yXSxbLjEsMCwyMzAsLC4wMSwuMTIsMywxLjUsLC40LCw1LjMyLC4wMSwsLCwsNSwuMDFdLFsuMywwLDc0MCwsLC4xNSwyLC4yLC0uMSwtLjE1LDksLjAyLCwuMSwuMTIsLC4wNl0sWy4yLDAsMTk2LCwsLjc0LCwwLCwuMywsLC4yOSwsLCwsLjM0LC4xNF0sWzEuMywwLDQzLCwsLjI1LCwsLCwsLCwyXSxbLjEsMCwyMiwsLjA3LC4wNyw0LDAsLCwuNSwuMDFdLFsuMSwwLDIyLC4wNCwuMDgsLCwwLCwsLCwsLjcsLDMsLCwuMTddLFsuMSwwLDIxMDAsLCwuMiwzLDAsLCwtNDAwLCwsMy4yLCwsLjE1XSxbLjEsMCwyNDUsLjE5LC4wOSwxLjE5LDEsMCwsMS4zLCwsLjA4LCwxLjUsLC4wOCwwLC4xN11dLFtbWywtLjEsOCwsLCwsLDgsLDIwLCw4LCw4LCwsLCwsOCwsLCw4LCwyMCwsLCw4LCwsLDExLCwsLCwsMTEsLDIzLCwxMSwsMTEsLCwsMjAsLDExLCwsLDExLCwyMywsLCwxMSwsLCxdLFsxLCwxMSwsLCw2LCwsLDgsLCwsMTEsLCwsMTAsLCwsNiwsLCwxMywsLCwxMCwsLCwxNSwsLCwxMywsLCw2LCwsLDgsLCwsMTMsLCwsMTEsLCwsMTUsLCwsMTEsLCwsXSxbMSwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLF1dLFtbLC0uMSw2LCwsLCwsNiwsMTgsLCwsNiwsLCwsLDYsLCwsNiwsMTgsLCwsNiwsLCw0LCwsLCwsNCwsMTYsLCwsNCwsLCwsLDYsLDYsLCwsMTgsLCwsNiwsLCxdLFsxLCwxOCwsLCwxMywsLCwxMCwsLCwxMywsLCwxMSwsLCwxMywsLCwxMCwsLCwxMywsLCw4LCwsLDEwLCwsLDExLCwsLDEzLCwsLDEwLCwsLCwsLCwxMywsLCwsLCwsXSxbLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsXV0sW1ssLS4xLDgsLCwsLCw4LCwyMCwsOCwsOCwsLCwsLDgsLCwsOCwsMjAsLCwsOCwsLCwxMSwsLCwsLDExLCwyMywsMTEsLDExLCwsLDIwLCwxMSwsLCwxMSwsMjMsLCwsMTEsLCwsXSxbMSwsMTEsLCwsNiwsLCw4LCwsLDExLCwsLDEwLCwsLDYsLCwsMTMsLCwsMTAsLCwsMTUsLCwsMTMsLCwsNiwsLCw4LCwsLDEzLCwsLDExLCwsLDE1LCwsLDExLCwsLF0sWzIsLDE1LCwxNCwsMTUsLDE0LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwxOSwsMTcsLDE1LCwxMCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsXV0sW1ssLS4xLDYsLCwsLCw2LCwxOCwsLCw2LCwsLCwsNiwsLCw2LCwxOCwsLCw2LCwsLDQsLCwsLCw0LCwxNiwsLCw0LCwsLCwsNiwsNiwsLCwxOCwsLCw2LCwsLF0sWzEsLDE4LCwsLDEzLCwsLDEwLCwsLDEzLCwsLDExLCwsLDEzLCwsLDEwLCwsLDEzLCwsLDgsLCwsMTAsLCwsMTEsLCwsMTMsLCwsMTAsLCwsLCwsLDEzLCwsLCwsLCxdLFsyLCwxNywsMTUsLDE0LCwxMCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsOCwsLCwxMCwsLCwxMiwsLCwxNSwsLCwxMCwsLCwxNCwsMTQsLCwsLCwsLCwsXV0sW1ssLS4xLDgsLCwsLCw4LCwyMCwsOCwsOCwsLCwsLDgsLCwsOCwsMjAsLCwsOCwsLCwxMSwsLCwsLDExLCwyMywsMTEsLDExLCwsLDIwLCwxMSwsLCwxMSwsMjMsLCwsMTEsLCwsXSxbMSwsMTEsLCwsNiwsLCw4LCwsLDExLCwsLDEwLCwsLDYsLCwsMTMsLCwsMTAsLCwsMTUsLCwsMTMsLCwsNiwsLCw4LCwsLDEzLCwsLDExLCwsLDE1LCwsLDExLCwsLF0sWzEsLDE1LCwsLCwsLCwsLCwsLCwsLCwsLCwxMSwsMTMsLDE1LCwxMywsMTEsLDYsLDExLCwsLCwsLCwsLCwsLCwsLCwsLCwxMSwsMTMsLDExLCw4LCw4LCwsLF1dLFtbLC0uMSw2LCwsLCwsNiwsMTgsLCwsNiwsLCwsLDYsLCwsNiwsMTgsLCwsNiwsLCw0LCwsLCwsNCwsMTYsLCwsNCwsLCwsLDYsLDYsLCwsMTgsLCwsNiwsLCxdLFsxLC0uMiwxOCwsLCwxMywsLCwxMCwsLCwxMywsLCwxMSwsLCwxMywsLCwxMCwsLCwxMywsLCw4LCwsLDEwLCwsLDExLCwsLDEzLCwsLDEwLCwsLCwsLCwxMywsLCwsLCwsXSxbMSwsMSwsLCwsLDEzLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwxMSwsLCwsLCwsMTMsLCwsLCwsLDEzLCwsLCwsLCwxOCwsLCwsLCwsXV0sW1ssLS4xLDgsLCwsLCw4LCwyMCwsOCwsOCwsLCwsLDgsLCwsOCwsMjAsLCwsOCwsLCwxMSwsLCwsLDExLCwyMywsMTEsLDExLCwsLDIwLCwxMSwsLCwxMSwsMjMsLCwsMTEsLCwsXSxbMSwsMTEsLCwsNiwsLCw4LCwsLDExLCwsLDEwLCwsLDYsLCwsMTMsLCwsMTAsLCwsMTUsLCwsMTMsLCwsNiwsLCw4LCwsLDEzLCwsLDExLCwsLDE1LCwsLDExLCwsLF0sWzEsLDE1LCwsLCwsLCwsLCwsLCwsLCwsLCwxMSwsMTMsLDE1LCwxMywsMTEsLDYsLDExLCwsLCwsLCwsLCwsLCwsLCwsLCwxMSwsMTMsLDExLCw4LCw4LCwsLF0sWzIsLDE1LCwxNCwsMTUsLDE0LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwxOSwsMTcsLDE1LCwxMCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsXV0sW1ssLS4xLDYsLCwsLCw2LCwxOCwsLCw2LCwsLCwsNiwsLCw2LCwxOCwsLCw2LCwsLDQsLCwsLCw0LCwxNiwsLCw0LCwsLCwsNiwsNiwsLCwxOCwsLCw2LCwsLF0sWzEsLS4yLDE4LCwsLDEzLCwsLDEwLCwsLDEzLCwsLDExLCwsLDEzLCwsLDEwLCwsLDEzLCwsLDgsLCwsMTAsLCwsMTEsLCwsMTMsLCwsMTAsLCwsLCwsLDEzLCwsLCwsLCxdLFsxLCwxLCwsLCwsMTMsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLDExLCwsLCwsLCwsLCwsLCwsLDEzLCwsLCwsLCwxOCwsLCwsLCwsXSxbMiwsMTcsLDE1LCwxNCwsMTAsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLDE1LCwsLDEwLCwsLDE0LCwxNCwsLCwsLCwsLCxdXSxbWywtLjEsOCwsLCwsLDgsLDIwLCw4LCw4LCwsLCwsOCwsLCw4LCwyMCwsLCw4LCwsLDExLCwsLCwsMTEsLDIzLCwxMSwsMTEsLCwsMjAsLDExLCwsLDExLCwyMywsLCwxMSwsLCxdLFsxLCwyMCwsLCwyMiwsLCwyMCwsLCwxOCwsLCwyMCwsLCwsLCwsMTUsLCwsLCwsLDEzLCwsLDExLCwsLDEwLCwsLDYsLCwsLCwsLCwsLCwsLCwsLCwsLF0sWzIsLDE1LDE3LDE1LDE3LDE1LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLDE1LDE3LDE1LDE3LDE1LDE3LDE1LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCxdLFs4LCwyNiwyNiwyNiwyNiwyNiwsLCwsLCwyNSwyNSwyNSwsLCwsLCwyOSwyOSwyOSwsLCwsLCwyNCwyNCwyNCwyNCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsXV0sW1ssLS4xLDQsLCwsLCw0LCwxNiwsLCw0LCwsLCwsNCwsLCw0LCwxNiwsLCw0LCwsLDYsLCwsLCw2LCwxOCwsLCw2LCwsLCwsNiwsNiwsLCwxOCwsLCw2LCwsLF0sWzEsLDE2LCwsLDE4LCwsLDE2LCwsLDExLCwsLCwsLCwsLCwsLCwsLCwsLCwxOCwsLCwxMywsLCwxMSwsLCwxMCwsLCwsLCwsLCwsLCwsLCwsLCwsXSxbOCwsMzEsMzEsMzEsMzEsMzEsLCwsLCwsMzAsMzAsMzAsLCwsLCwsMzQsMzQsMzQsLCwsLCwsMjksMjksMjksMjksLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLF1dLFtbLC0uMSw4LCwsLCwsOCwsMjAsLDgsLDgsLCwsLCw4LCwsLDgsLDIwLCwsLDgsLCwsMTEsLCwsLCwxMSwsMjMsLDExLCwxMSwsLCwyMCwsMTEsLCwsMTEsLDIzLCwsLDExLCwsLF0sWzEsLDIwLCwsLDIyLCwsLDIwLCwsLDE4LCwsLDIwLCwsLCwsLCwxNSwsLCwsLCwsMTMsLCwsMTEsLCwsMTAsLCwsNiwsLCwsLCwsLCwsLCwsLCwsLCwsXSxbMiwsMTUsLDE0LCwxNSwsMTQsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLDE5LCwxNywsMTUsLDEwLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCxdXSxbWywtLjEsNCwsLCwsLDQsLDE2LCwsLDQsLCwsLCw0LCwsLDQsLDE2LCwsLDQsLCwsNiwsLCwsLDYsLDE4LCwsLDYsLCwsLCw2LCw2LCwsLDE4LCwsLDYsLCwsXSxbMSwsMTYsLCwsMTgsLCwsMTYsLCwsMTEsLCwsLCwsLCwsLCwsLCwsLCwsLDEwLCwsLDExLCwsLDEyLCwsLDEzLCwsLDEwLCwxMSwsMTIsLDEzLCwxMCwsMTEsLDEyLCwxMywsXSxbMiwsMTcsLDE1LCwxNCwsMTAsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsXV0sW1ssLDYsLDYsLDYsLDYsLDYsLCwsLCwsLDYsLDYsLDYsLDYsLDYsLCwsLCwsLDYsLDYsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCxdLFsxLCwxMCwsMTEsLDEyLCwxMywsMTAsLDExLCwxMiwsMTMsLDEwLCwxMSwsMTIsLDEzLCwxMCwsMTEsLDEyLCwxMCwsMTEsLDEyLCwyMCwsLCwxOSwsLCwxOCwsLCwxNywsLCwyMCwsLCwxOSwsLCwxOCwsLCxdLFszLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwxNiwsLCwxNSwsLCwxNCwsLCwxMywsLCwxNiwsLCwxNSwsLCwxNCwsLCxdLFs0LC0uMSw2LCw2LCw2LCw2LCw2LCwsLCwsLCw2LCw2LCw2LCw2LCw2LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLF0sWzUsLDI5LCwyOSwsLCwsLCwsLCwsLCwsMjksLDI5LCwsLCwsLCwsLCwsLCwyOSwsMjksLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCxdXSxbWywtLjEsOCwsLCwsLDgsLDIwLCw4LCw4LCwsLCwsOCwsLCw4LCwyMCwsLCw4LCwsLDExLCwsLCwsMTEsLDIzLCwxMSwsMTEsLCwsMjMsLDExLCwsLDExLCwyMywsLCwxMSwsLCxdLFsxLCwxMSwsLCwsLDEwLCwsLCwsMywsLCwsLDExLCwsLCwsMTAsLCwsMywsLCwxMSwsLCwsLDEwLCwsLCwsMSwsLCwsLDExLCwsLCwsMTAsLCwsMSwsLCxdLFszLCwzMCwsLCwsLCwsLCwsLCwsLCwzMCwsLCwyOCwsLCwyNiwsLCwyOCwsLCwyNiwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsXSxbMywsMjYsLCwsLCwsLCwsLCwsLCwsMjYsLCwsMjUsLCwsMjMsLCwsMjUsLCwsMTgsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLF1dLFtbLC0uMSw0LCwsLCwsNCwsMTYsLDQsLDQsLCwsLCw0LCwsLDQsLDE2LCwsLDQsLCwsNiwsLCwsLDYsLDE4LCw2LCw2LCwsLDE4LCw2LCwsLDYsLDE4LCwsLDYsLCwsXSxbMSwsMTEsLCwsLCwxMCwsLCwsLDQsLCwsLCwxMSwsLCwsLDEwLCwsLDQsLCwsMTEsLCwsLCwxMCwsLCwsLDYsLCwsLCwxMSwsLCwsLDEwLCwsLDYsLCwsXSxbMywsMjYsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwyNiwsLCwsLCwsNCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsXSxbMywsMjMsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwyMywsLCwsLCwsMjUsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLF1dLFtbLC0uMSw0LCwsLCwsNCwsMTYsLDQsLDQsLCwsLCw0LCwsLDQsLDE2LCwsLDQsLCwsNiwsLCwsLDYsLDE4LCw2LCw2LCwsLDE4LCw2LCwsLDYsLDE4LCwsLDYsLCwsXSxbMSwsMTEsMTAsMTEsMTAsMTEsMTAsLCw0LCwsLDExLCwsLDEwLCwsLDQsLCwsMTEsLCwsNCwsLCwxMSwxMCwxMSwxMCwxMSwxMCwsLDYsLCwsMTEsLCwsMTAsLCwsNiwsLCwxMSwsLCw2LCwsLF0sWzMsLDI2LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsMjYsLCwsLCwsLDI4LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCxdLFszLCwyMywsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLDIzLCwsLCwsLCwyNSwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsXV0sW1ssLS4xLDgsLCwsLCw4LCwyMCwsOCwsOCwsLCwsLDgsLCwsOCwsMjAsLCwsOCwsLCwxMSwsLCwsLDExLCwyMywsMTEsLDExLCwsLDIzLCwxMSwsLCwxMSwsMjMsLCwsMTEsLCwsXSxbMSwsMTEsMTAsMTEsMTAsMTEsMTAsLCwzLCwsLDExLCwsLDEwLCwsLDMsLCwsMTAsLCwsMywsLCwxMSwxMCwxMSwxMCwxMSwxMCwsLDEsLCwsMTEsLCwsMTAsLCwsMSwsLCwxMSwsLCwxLCwsLF0sWzMsLDMwLCwsLCwsLCwsLCwsLCwsLDMwLCwsLDI4LCwsLDI2LCwsLDI4LCwsLDI2LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCxdLFszLCwyNiwsLCwsLCwsLCwsLCwsLCwyNiwsLCwyNSwsLCwyMywsLCwyNSwsLCwxOCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsXV0sW1s3LCwsLDYsLDYsLCwsNiwsLCw2LCwsLDYsLCwsNiwsLCw2LCwsLDYsLCwsNiwsLCw2LCwsLDYsLCwsNiwsLCw2LCwsLDYsLCwsNiwsLCw2LCwsLF0sWzEsLDEwLCwxMSwsMTIsLDEzLCwxMCwsMTEsLDEyLCwxMywsMTAsLDExLCwxMiwsMTMsLDEwLCwxMSwsMTIsLDEwLCwxMSwsMTIsLDIwLCwsLDE5LCwsLDE4LCwsLDE3LCwsLDIwLCwsLDE5LCwsLDE4LCwsLF0sWzMsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLDE2LCwsLDE1LCwsLDE0LCwsLDEzLCwsLDE2LCwsLDE1LCwsLDE0LCwsLF0sWzQsLS4xLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLDYsLF0sWzUsLDI5LCwyOSwsLCwsLCwsLCwsLCwsMjksLDI5LCwsLCwsLCwsLCwsLCwyOSwsMjksLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCxdLFs2LCwsMjksLDI5LCwyOSwsMjksLCwsLCwsLCwsMjksLDI5LCwyOSwsMjksLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLF0sWzIsLDE1LCwxNiwsMTcsLDE4LCwxNSwsMTYsLDE3LCwxOCwsMTUsLDE2LCwxNywsMTgsLDE1LCwxNiwsMTcsLDE4LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLF1dXSxbMCwxLDIsMyw0LDUsNiw3LDgsOSwxMCwxMSwxMiwxNywxNCwxMywxNSwxNiwxMl0sMjEwXSIsImltcG9ydCBhY2N1bXVsYXRlRnJhZ21lbnRTaGFkZXIgZnJvbSBcIi4vc2hhZGVycy9hY2N1bXVsYXRlLmZyYWdcIjtcbmltcG9ydCBibGVuZEZyYWdtZW50U2hhZGVyIGZyb20gXCIuL3NoYWRlcnMvYmxlbmQuZnJhZ1wiO1xuaW1wb3J0IGJsdXJGcmFnbWVudFNoYWRlciBmcm9tIFwiLi9zaGFkZXJzL2JsdXIuZnJhZ1wiO1xuaW1wb3J0IGNvbW1vblZlcnRleFNoYWRlciBmcm9tIFwiLi9zaGFkZXJzL2NvbW1vbi52ZXJ0XCI7XG5pbXBvcnQgY29weUZyYWdtZW50U2hhZGVyIGZyb20gXCIuL3NoYWRlcnMvY29weS5mcmFnXCI7XG5pbXBvcnQgY3J0RnJhZ21lbnRTaGFkZXIgZnJvbSBcIi4vc2hhZGVycy9jcnQuZnJhZ1wiO1xuXG50eXBlIFRleEZibyA9IHsgdGV4OiBXZWJHTFRleHR1cmU7IGZibzogV2ViR0xGcmFtZWJ1ZmZlciB9O1xuXG5jb25zdCBlbnVtIEdMIHtcbiAgQVJSQVlfQlVGRkVSID0gMHg4ODkyLFxuICBDTEFNUF9UT19FREdFID0gMHg4MTJmLFxuICBDT0xPUl9BVFRBQ0hNRU5UMCA9IDB4OGNlMCxcbiAgQ09NUElMRV9TVEFUVVMgPSAweDhiODEsXG4gIEZMT0FUID0gMHgxNDA2LFxuICBGUkFHTUVOVF9TSEFERVIgPSAweDhiMzAsXG4gIEZSQU1FQlVGRkVSID0gMHg4ZDQwLFxuICBMSU5FQVIgPSAweDI2MDEsXG4gIExJTktfU1RBVFVTID0gMHg4YjgyLFxuICBORUFSRVNUID0gMHgyNjAwLFxuICBSR0JBID0gMHgxOTA4LFxuICBTVEFUSUNfRFJBVyA9IDB4ODhlNCxcbiAgVEVYVFVSRTAgPSAweDg0YzAsXG4gIFRFWFRVUkUxID0gMHg4NGMxLFxuICBURVhUVVJFXzJEID0gMHgwZGUxLFxuICBURVhUVVJFX01BR19GSUxURVIgPSAweDI4MDAsXG4gIFRFWFRVUkVfTUlOX0ZJTFRFUiA9IDB4MjgwMSxcbiAgVEVYVFVSRV9XUkFQX1MgPSAweDI4MDIsXG4gIFRFWFRVUkVfV1JBUF9UID0gMHgyODAzLFxuICBUUklBTkdMRV9GQU4gPSAweDAwMDYsXG4gIFVOU0lHTkVEX0JZVEUgPSAweDE0MDEsXG4gIFZFUlRFWF9TSEFERVIgPSAweDhiMzFcbn1cblxuY29uc3QgaW5pdFJlbmRlcmVyID0gKHRhcmdldENhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpID0+IHtcbiAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgY29uc3QgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dChcIndlYmdsXCIpITtcbiAgY29uc3QgZ2xHZXRVbmlmb3JtTG9jYXRpb24gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24uYmluZChnbCk7XG4gIGNvbnN0IHRhcmdldENvbnRleHQgPSB0YXJnZXRDYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcbiAgY29uc3QgdW5iaW5kID0gKC4uLmFyZ3M6IGFueVtdKSA9PiB7XG4gICAgZm9yIChjb25zdCBhcmcgb2YgYXJncykge1xuICAgICAgc3dpdGNoIChhcmcpIHtcbiAgICAgICAgY2FzZSBHTC5GUkFNRUJVRkZFUjpcbiAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoYXJnLCBudWxsKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBHTC5URVhUVVJFXzJEOlxuICAgICAgICAgIGdsLmJpbmRUZXh0dXJlKGFyZywgbnVsbCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgR0wuQVJSQVlfQlVGRkVSOlxuICAgICAgICAgIGdsLmJpbmRCdWZmZXIoYXJnLCBudWxsKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBnbC5hY3RpdmVUZXh0dXJlKGFyZyk7XG4gICAgICAgICAgZ2wuYmluZFRleHR1cmUoR0wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBjb25zdCBjb21waWxlU2hhZGVyID0gKHNvdXJjZTogc3RyaW5nLCB0eXBlOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIodHlwZSkhO1xuICAgIGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNvdXJjZSk7XG4gICAgZ2wuY29tcGlsZVNoYWRlcihzaGFkZXIpO1xuICAgIGlmICghZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKHNoYWRlciwgR0wuQ09NUElMRV9TVEFUVVMpKSB7XG4gICAgICBjb25zdCBpbmZvID0gZ2wuZ2V0U2hhZGVySW5mb0xvZyhzaGFkZXIpO1xuICAgICAgdGhyb3cgXCJjb3VsZCBub3QgY29tcGlsZSBzaGFkZXI6XCIgKyBpbmZvO1xuICAgIH1cbiAgICByZXR1cm4gc2hhZGVyO1xuICB9O1xuICBjb25zdCB2cyA9IGNvbXBpbGVTaGFkZXIoY29tbW9uVmVydGV4U2hhZGVyLCBHTC5WRVJURVhfU0hBREVSKTtcbiAgY29uc3QgZnNfY3J0ID0gY29tcGlsZVNoYWRlcihjcnRGcmFnbWVudFNoYWRlciwgR0wuRlJBR01FTlRfU0hBREVSKTtcbiAgY29uc3QgZnNfYmx1ciA9IGNvbXBpbGVTaGFkZXIoYmx1ckZyYWdtZW50U2hhZGVyLCBHTC5GUkFHTUVOVF9TSEFERVIpO1xuICBjb25zdCBmc19hY2N1bXVsYXRlID0gY29tcGlsZVNoYWRlcihhY2N1bXVsYXRlRnJhZ21lbnRTaGFkZXIsIEdMLkZSQUdNRU5UX1NIQURFUik7XG4gIGNvbnN0IGZzX2JsZW5kID0gY29tcGlsZVNoYWRlcihibGVuZEZyYWdtZW50U2hhZGVyLCBHTC5GUkFHTUVOVF9TSEFERVIpO1xuICBjb25zdCBmc19jb3B5ID0gY29tcGlsZVNoYWRlcihjb3B5RnJhZ21lbnRTaGFkZXIsIEdMLkZSQUdNRU5UX1NIQURFUik7XG4gIGNvbnN0IGNyZWF0ZVByb2dyYW0gPSAodnM6IFdlYkdMU2hhZGVyLCBmczogV2ViR0xTaGFkZXIsIG5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHByb2dyYW0gPSBnbC5jcmVhdGVQcm9ncmFtKCkhO1xuICAgIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCB2cyk7XG4gICAgZ2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIGZzKTtcbiAgICBnbC5saW5rUHJvZ3JhbShwcm9ncmFtKTtcbiAgICBpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIocHJvZ3JhbSwgR0wuTElOS19TVEFUVVMpKSB7XG4gICAgICBjb25zdCBpbmZvID0gZ2wuZ2V0UHJvZ3JhbUluZm9Mb2cocHJvZ3JhbSk7XG4gICAgICB0aHJvdyBcInNoYWRlciBcIiArIG5hbWUgKyBcIiBmYWlsZWQgdG8gbGluazpcIiArIGluZm87XG4gICAgfVxuICAgIHJldHVybiBwcm9ncmFtO1xuICB9O1xuICBjb25zdCBjcnRfcHJvZ3JhbSA9IGNyZWF0ZVByb2dyYW0odnMsIGZzX2NydCwgXCJjcnRfcHJvZ3JhbVwiKTtcbiAgY29uc3QgbG9jX2NydF9wb3MgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihjcnRfcHJvZ3JhbSwgXCJwb3NcIik7XG4gIGNvbnN0IGxvY19jcnRfdGltZSA9IGdsR2V0VW5pZm9ybUxvY2F0aW9uKGNydF9wcm9ncmFtLCBcInRpbWVcIik7XG4gIGNvbnN0IGxvY19jcnRfYmFja2J1ZmZlciA9IGdsR2V0VW5pZm9ybUxvY2F0aW9uKGNydF9wcm9ncmFtLCBcImJhY2tidWZmZXJcIik7XG4gIGNvbnN0IGxvY19jcnRfYmx1cmJ1ZmZlciA9IGdsR2V0VW5pZm9ybUxvY2F0aW9uKGNydF9wcm9ncmFtLCBcImJsdXJidWZmZXJcIik7XG4gIGNvbnN0IGxvY19jcnRfcmVzb2x1dGlvbiA9IGdsR2V0VW5pZm9ybUxvY2F0aW9uKGNydF9wcm9ncmFtLCBcInJlc29sdXRpb25cIik7XG4gIGNvbnN0IGJsdXJfcHJvZ3JhbSA9IGNyZWF0ZVByb2dyYW0odnMsIGZzX2JsdXIsIFwiYmx1cl9wcm9ncmFtXCIpO1xuICBjb25zdCBsb2NfYmx1cl9wb3MgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihibHVyX3Byb2dyYW0sIFwicG9zXCIpO1xuICBjb25zdCBsb2NfYmx1cl9ibHVyID0gZ2xHZXRVbmlmb3JtTG9jYXRpb24oYmx1cl9wcm9ncmFtLCBcImJsdXJcIik7XG4gIGNvbnN0IGxvY19ibHVyX3RleHR1cmUgPSBnbEdldFVuaWZvcm1Mb2NhdGlvbihibHVyX3Byb2dyYW0sIFwidGV4dHVyZVwiKTtcbiAgY29uc3QgYWNjdW11bGF0ZV9wcm9ncmFtID0gY3JlYXRlUHJvZ3JhbSh2cywgZnNfYWNjdW11bGF0ZSwgXCJhY2N1bXVsYXRlX3Byb2dyYW1cIik7XG4gIGNvbnN0IGxvY19hY2N1bXVsYXRlX3BvcyA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKGFjY3VtdWxhdGVfcHJvZ3JhbSwgXCJwb3NcIik7XG4gIGNvbnN0IGxvY19hY2N1bXVsYXRlX3RleDAgPSBnbEdldFVuaWZvcm1Mb2NhdGlvbihhY2N1bXVsYXRlX3Byb2dyYW0sIFwidGV4MFwiKTtcbiAgY29uc3QgbG9jX2FjY3VtdWxhdGVfdGV4MSA9IGdsR2V0VW5pZm9ybUxvY2F0aW9uKGFjY3VtdWxhdGVfcHJvZ3JhbSwgXCJ0ZXgxXCIpO1xuICBjb25zdCBsb2NfYWNjdW11bGF0ZV9tb2R1bGF0ZSA9IGdsR2V0VW5pZm9ybUxvY2F0aW9uKGFjY3VtdWxhdGVfcHJvZ3JhbSwgXCJtb2R1bGF0ZVwiKTtcbiAgY29uc3QgYmxlbmRfcHJvZ3JhbSA9IGNyZWF0ZVByb2dyYW0odnMsIGZzX2JsZW5kLCBcImJsZW5kX3Byb2dyYW1cIik7XG4gIGNvbnN0IGxvY19ibGVuZF9wb3MgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihibGVuZF9wcm9ncmFtLCBcInBvc1wiKTtcbiAgY29uc3QgbG9jX2JsZW5kX3RleDAgPSBnbEdldFVuaWZvcm1Mb2NhdGlvbihibGVuZF9wcm9ncmFtLCBcInRleDBcIik7XG4gIGNvbnN0IGxvY19ibGVuZF90ZXgxID0gZ2xHZXRVbmlmb3JtTG9jYXRpb24oYmxlbmRfcHJvZ3JhbSwgXCJ0ZXgxXCIpO1xuICBjb25zdCBsb2NfYmxlbmRfbW9kdWxhdGUgPSBnbEdldFVuaWZvcm1Mb2NhdGlvbihibGVuZF9wcm9ncmFtLCBcIm1vZHVsYXRlXCIpO1xuICBjb25zdCBjb3B5X3Byb2dyYW0gPSBjcmVhdGVQcm9ncmFtKHZzLCBmc19jb3B5LCBcImNvcHlfcHJvZ3JhbVwiKTtcbiAgY29uc3QgbG9jX2NvcHlfcG9zID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24oY29weV9wcm9ncmFtLCBcInBvc1wiKTtcbiAgY29uc3QgbG9jX2NvcHlfdGV4MCA9IGdsR2V0VW5pZm9ybUxvY2F0aW9uKGNvcHlfcHJvZ3JhbSwgXCJ0ZXgwXCIpO1xuICBjb25zdCBwb3NCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgY29uc3QgYmluZFZlcnRleEJ1ZmZlciA9IChsb2NfcG9zOiBudW1iZXIpID0+IHtcbiAgICBnbC5iaW5kQnVmZmVyKEdMLkFSUkFZX0JVRkZFUiwgcG9zQnVmZmVyKTtcbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvY19wb3MsIDQsIEdMLkZMT0FULCBmYWxzZSwgMCwgMCk7XG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkobG9jX3Bvcyk7XG4gIH07XG4gIGNvbnN0IHRleF9iYWNrYnVmZmVyID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICBjb25zdCB0ZXhGYm9zOiBBcnJheTxUZXhGYm8+ID0gW107XG4gIGNvbnN0IGRyYXdCbHVyQXhpcyA9IChzcmNUZXg6IFdlYkdMVGV4dHVyZSwgZHN0QnVmOiBXZWJHTEZyYW1lYnVmZmVyLCBibHVyWDogbnVtYmVyLCBibHVyWTogbnVtYmVyKSA9PiB7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKEdMLkZSQU1FQlVGRkVSLCBkc3RCdWYpO1xuICAgIGdsLnVzZVByb2dyYW0oYmx1cl9wcm9ncmFtKTtcbiAgICBiaW5kVmVydGV4QnVmZmVyKGxvY19ibHVyX3Bvcyk7XG4gICAgZ2wudW5pZm9ybTJmKGxvY19ibHVyX2JsdXIsIGJsdXJYLCBibHVyWSk7XG4gICAgZ2wudW5pZm9ybTFpKGxvY19ibHVyX3RleHR1cmUsIDApO1xuICAgIGdsLmFjdGl2ZVRleHR1cmUoR0wuVEVYVFVSRTApO1xuICAgIGdsLmJpbmRUZXh0dXJlKEdMLlRFWFRVUkVfMkQsIHNyY1RleCk7XG4gICAgZ2wuZHJhd0FycmF5cyhHTC5UUklBTkdMRV9GQU4sIDAsIDQpO1xuICAgIHVuYmluZChHTC5URVhUVVJFXzJELCBHTC5BUlJBWV9CVUZGRVIsIEdMLkZSQU1FQlVGRkVSKTtcbiAgfTtcbiAgY29uc3QgZHJhd0JsdXIgPSAoc3JjVGV4OiBXZWJHTFRleHR1cmUsIGRzdEJ1ZjogV2ViR0xGcmFtZWJ1ZmZlciwgdG1wOiBUZXhGYm8sIHI6IG51bWJlciwgdzogbnVtYmVyLCBoOiBudW1iZXIpID0+IHtcbiAgICBkcmF3Qmx1ckF4aXMoc3JjVGV4LCB0bXAuZmJvLCByIC8gdywgMCk7XG4gICAgZHJhd0JsdXJBeGlzKHRtcC50ZXgsIGRzdEJ1ZiwgMCwgciAvIGgpO1xuICB9O1xuICBjb25zdCBkcmF3Q29weSA9IChzcmNUZXg6IFdlYkdMVGV4dHVyZSwgZHN0QnVmOiBXZWJHTEZyYW1lYnVmZmVyKSA9PiB7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKEdMLkZSQU1FQlVGRkVSLCBkc3RCdWYpO1xuICAgIGdsLnVzZVByb2dyYW0oY29weV9wcm9ncmFtKTtcbiAgICBiaW5kVmVydGV4QnVmZmVyKGxvY19jb3B5X3Bvcyk7XG4gICAgZ2wudW5pZm9ybTFpKGxvY19jb3B5X3RleDAsIDApO1xuICAgIGdsLmFjdGl2ZVRleHR1cmUoR0wuVEVYVFVSRTApO1xuICAgIGdsLmJpbmRUZXh0dXJlKEdMLlRFWFRVUkVfMkQsIHNyY1RleCk7XG4gICAgZ2wuZHJhd0FycmF5cyhHTC5UUklBTkdMRV9GQU4sIDAsIDQpO1xuICAgIHVuYmluZChHTC5URVhUVVJFXzJELCBHTC5BUlJBWV9CVUZGRVIsIEdMLkZSQU1FQlVGRkVSKTtcbiAgfTtcblxuICBsZXQgbGFzdER3ID0gLTE7XG4gIGxldCBsYXN0RGggPSAtMTtcbiAgbGV0IGk6IG51bWJlcjtcbiAgbGV0IHRhcmdldFNjYWxlOiBudW1iZXI7XG5cbiAgY2FudmFzLnN0eWxlLmNzc1RleHQgPSBcImRpc3BsYXk6YmxvY2s7bWFyZ2luOjAgYXV0bztoZWlnaHQ6MTAwJTtcIjtcbiAgY2FudmFzLndpZHRoID0gdGFyZ2V0Q2FudmFzLmNsaWVudFdpZHRoO1xuICBjYW52YXMuaGVpZ2h0ID0gdGFyZ2V0Q2FudmFzLmNsaWVudEhlaWdodDtcblxuICB0YXJnZXRDYW52YXMucGFyZW50Tm9kZSEuaW5zZXJ0QmVmb3JlKGNhbnZhcywgdGFyZ2V0Q2FudmFzKTtcbiAgdGFyZ2V0Q2FudmFzLnN0eWxlLm9wYWNpdHkgPSBcIjBcIjtcblxuICBnbC5iaW5kQnVmZmVyKEdMLkFSUkFZX0JVRkZFUiwgcG9zQnVmZmVyKTtcbiAgZ2wuYnVmZmVyRGF0YShcbiAgICBHTC5BUlJBWV9CVUZGRVIsXG4gICAgbmV3IEZsb2F0MzJBcnJheShbLTEsIC0xLCAwLCAwLCAxLCAtMSwgMSwgMCwgMSwgMSwgMSwgMSwgLTEsIDEsIDAsIDFdKSxcbiAgICBHTC5TVEFUSUNfRFJBV1xuICApO1xuICB1bmJpbmQoR0wuQVJSQVlfQlVGRkVSKTtcblxuICBnbC5hY3RpdmVUZXh0dXJlKEdMLlRFWFRVUkUwKTtcbiAgZ2wuYmluZFRleHR1cmUoR0wuVEVYVFVSRV8yRCwgdGV4X2JhY2tidWZmZXIpO1xuICBnbC50ZXhQYXJhbWV0ZXJpKEdMLlRFWFRVUkVfMkQsIEdMLlRFWFRVUkVfV1JBUF9TLCBHTC5DTEFNUF9UT19FREdFKTtcbiAgZ2wudGV4UGFyYW1ldGVyaShHTC5URVhUVVJFXzJELCBHTC5URVhUVVJFX1dSQVBfVCwgR0wuQ0xBTVBfVE9fRURHRSk7XG4gIGdsLnRleFBhcmFtZXRlcmkoR0wuVEVYVFVSRV8yRCwgR0wuVEVYVFVSRV9NSU5fRklMVEVSLCBHTC5ORUFSRVNUKTtcbiAgZ2wudGV4UGFyYW1ldGVyaShHTC5URVhUVVJFXzJELCBHTC5URVhUVVJFX01BR19GSUxURVIsIEdMLk5FQVJFU1QpO1xuICB1bmJpbmQoR0wuVEVYVFVSRV8yRCk7XG5cbiAgZm9yIChpID0gMDsgaSA8IDQ7ICsraSkge1xuICAgIGNvbnN0IHRleCA9IGdsLmNyZWF0ZVRleHR1cmUoKSE7XG4gICAgY29uc3QgZmJvID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKSE7XG4gICAgZ2wuYWN0aXZlVGV4dHVyZShHTC5URVhUVVJFMCk7XG4gICAgZ2wuYmluZFRleHR1cmUoR0wuVEVYVFVSRV8yRCwgdGV4KTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKEdMLlRFWFRVUkVfMkQsIEdMLlRFWFRVUkVfV1JBUF9TLCBHTC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKEdMLlRFWFRVUkVfMkQsIEdMLlRFWFRVUkVfV1JBUF9ULCBHTC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKEdMLlRFWFRVUkVfMkQsIEdMLlRFWFRVUkVfTUlOX0ZJTFRFUiwgR0wuTElORUFSKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKEdMLlRFWFRVUkVfMkQsIEdMLlRFWFRVUkVfTUFHX0ZJTFRFUiwgR0wuTElORUFSKTtcbiAgICB1bmJpbmQoR0wuVEVYVFVSRV8yRCk7XG4gICAgdGV4RmJvcy5wdXNoKHsgdGV4LCBmYm8gfSk7XG4gIH1cbiAgY29uc3QgYmx1cl9idWYgPSB0ZXhGYm9zWzBdO1xuICBjb25zdCBibHVyX3RtcCA9IHRleEZib3NbMV07XG4gIGNvbnN0IGFjY3VtX2J1ZiA9IHRleEZib3NbMl07XG4gIGNvbnN0IGFjY3VtX2NweSA9IHRleEZib3NbM107XG5cbiAgcmV0dXJuIChub3c6IG51bWJlcikgPT4ge1xuICAgIC8qIGhhY2sgZml4IGZvciBTYWZhcmk6IHRleEltYWdlMkQgZmFpbHMgdG8gY29weSB0YXJnZXRDYW52YXMgdG8gdGV4X2JhY2tidWZmZXIgKi9cbiAgICB0YXJnZXRDb250ZXh0LnJlc2V0VHJhbnNmb3JtKCk7XG4gICAgdGFyZ2V0Q29udGV4dC5jbGVhclJlY3QoLTEsIC0xLCAxLCAxKTtcblxuICAgIHRhcmdldFNjYWxlID0gTWF0aC5jZWlsKFxuICAgICAgTWF0aC5tYXgodGFyZ2V0Q2FudmFzLmNsaWVudFdpZHRoIC8gdGFyZ2V0Q2FudmFzLndpZHRoLCB0YXJnZXRDYW52YXMuY2xpZW50SGVpZ2h0IC8gdGFyZ2V0Q2FudmFzLmhlaWdodClcbiAgICApO1xuICAgIHRhcmdldFNjYWxlID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oNCwgdGFyZ2V0U2NhbGUpKTtcblxuICAgIGNvbnN0IGR3ID0gdGFyZ2V0Q2FudmFzLndpZHRoICogdGFyZ2V0U2NhbGU7XG4gICAgY29uc3QgZGggPSB0YXJnZXRDYW52YXMuaGVpZ2h0ICogdGFyZ2V0U2NhbGU7XG4gICAgY29uc3QgY3cgPSAoY2FudmFzLndpZHRoID0gdGFyZ2V0Q2FudmFzLmNsaWVudFdpZHRoKTtcbiAgICBjb25zdCBjaCA9IChjYW52YXMuaGVpZ2h0ID0gdGFyZ2V0Q2FudmFzLmNsaWVudEhlaWdodCk7XG4gICAgY29uc3QgdGltZSA9IG5vdyAqIDAuMDAxO1xuXG4gICAgaWYgKGxhc3REdyAhPSBkdyB8fCBsYXN0RGggIT0gZGgpIHtcbiAgICAgIGZvciAoY29uc3QgeyB0ZXg6IHRleHR1cmUsIGZibzogZnJhbWVidWZmZXIgfSBvZiB0ZXhGYm9zKSB7XG4gICAgICAgIGdsLmFjdGl2ZVRleHR1cmUoR0wuVEVYVFVSRTApO1xuICAgICAgICBnbC5iaW5kVGV4dHVyZShHTC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICAgICAgZ2wudGV4SW1hZ2UyRChHTC5URVhUVVJFXzJELCAwLCBHTC5SR0JBLCBkdywgZGgsIDAsIEdMLlJHQkEsIEdMLlVOU0lHTkVEX0JZVEUsIG51bGwpO1xuICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoR0wuRlJBTUVCVUZGRVIsIGZyYW1lYnVmZmVyKTtcbiAgICAgICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoR0wuRlJBTUVCVUZGRVIsIEdMLkNPTE9SX0FUVEFDSE1FTlQwLCBHTC5URVhUVVJFXzJELCB0ZXh0dXJlLCAwKTtcbiAgICAgICAgdW5iaW5kKEdMLlRFWFRVUkVfMkQsIEdMLkZSQU1FQlVGRkVSKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKiBibGl0IHRhcmdlIHNjcmVlbiB0byBiYWNrYnVmZmVyOyBiYWNrYnVmZmVyID0gdGV4SW1hZ2UyRCh0YXJnZXRDYW52YXMpICovXG4gICAgZ2wuYWN0aXZlVGV4dHVyZShHTC5URVhUVVJFMCk7XG4gICAgZ2wuYmluZFRleHR1cmUoR0wuVEVYVFVSRV8yRCwgdGV4X2JhY2tidWZmZXIpO1xuICAgIGdsLnRleEltYWdlMkQoR0wuVEVYVFVSRV8yRCwgMCwgR0wuUkdCQSwgR0wuUkdCQSwgR0wuVU5TSUdORURfQllURSwgdGFyZ2V0Q2FudmFzKTtcbiAgICB1bmJpbmQoR0wuVEVYVFVSRV8yRCk7XG5cbiAgICBnbC52aWV3cG9ydCgwLCAwLCBkdywgZGgpO1xuXG4gICAgLyogYmx1ciBwcmV2aW91cyBhY2N1bXVsYXRpb24gYnVmZmVyOyBibHVyX2J1ZiA9IGJsdXIoYWNjdW1fY3B5KSAqL1xuICAgIGRyYXdCbHVyKGFjY3VtX2NweS50ZXgsIGJsdXJfYnVmLmZibywgYmx1cl90bXAsIDEuMCwgZHcsIGRoKTtcblxuICAgIC8qIHVwZGF0ZSBhY2N1bXVsYXRpb24gYnVmZmVyOyBhY2N1bV9idWYgPSBhY2N1bXVsYXRlKGJhY2tidWZmZXIsIGJsdXJfYnVmKSAqL1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihHTC5GUkFNRUJVRkZFUiwgYWNjdW1fYnVmLmZibyk7XG4gICAgZ2wudXNlUHJvZ3JhbShhY2N1bXVsYXRlX3Byb2dyYW0pO1xuICAgIGJpbmRWZXJ0ZXhCdWZmZXIobG9jX2FjY3VtdWxhdGVfcG9zKTtcbiAgICBnbC51bmlmb3JtMWkobG9jX2FjY3VtdWxhdGVfdGV4MCwgMCk7XG4gICAgZ2wudW5pZm9ybTFpKGxvY19hY2N1bXVsYXRlX3RleDEsIDEpO1xuICAgIGdsLnVuaWZvcm0xZihsb2NfYWNjdW11bGF0ZV9tb2R1bGF0ZSwgMS4wKTtcbiAgICBnbC5hY3RpdmVUZXh0dXJlKEdMLlRFWFRVUkUwKTtcbiAgICBnbC5iaW5kVGV4dHVyZShHTC5URVhUVVJFXzJELCB0ZXhfYmFja2J1ZmZlcik7XG4gICAgZ2wuYWN0aXZlVGV4dHVyZShHTC5URVhUVVJFMSk7XG4gICAgZ2wuYmluZFRleHR1cmUoR0wuVEVYVFVSRV8yRCwgYmx1cl9idWYudGV4KTtcbiAgICBnbC5kcmF3QXJyYXlzKEdMLlRSSUFOR0xFX0ZBTiwgMCwgNCk7XG4gICAgdW5iaW5kKEdMLlRFWFRVUkUwLCBHTC5URVhUVVJFMSwgR0wuQVJSQVlfQlVGRkVSLCBHTC5GUkFNRUJVRkZFUik7XG5cbiAgICAvKiBzdG9yZSBjb3B5IG9mIGFjY3VtdWxhdGlvbiBidWZmZXI7IGFjY3VtX2NweSA9IGNvcHkoYWNjdW1fYnVmKSAqL1xuICAgIGRyYXdDb3B5KGFjY3VtX2J1Zi50ZXgsIGFjY3VtX2NweS5mYm8pO1xuXG4gICAgLyogYmxlbmQgYWNjdW11bGF0aW9uIGFuZCBiYWNrYnVmZmVyOyBhY2N1bV9idWYgPSBibGVuZChiYWNrYnVmZmVyLCBhY2N1bV9jcHkpICovXG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKEdMLkZSQU1FQlVGRkVSLCBhY2N1bV9idWYuZmJvKTtcbiAgICBnbC51c2VQcm9ncmFtKGJsZW5kX3Byb2dyYW0pO1xuICAgIGJpbmRWZXJ0ZXhCdWZmZXIobG9jX2JsZW5kX3Bvcyk7XG4gICAgZ2wudW5pZm9ybTFpKGxvY19ibGVuZF90ZXgwLCAwKTtcbiAgICBnbC51bmlmb3JtMWkobG9jX2JsZW5kX3RleDEsIDEpO1xuICAgIGdsLnVuaWZvcm0xZihsb2NfYmxlbmRfbW9kdWxhdGUsIDEuMCk7XG4gICAgZ2wuYWN0aXZlVGV4dHVyZShHTC5URVhUVVJFMCk7XG4gICAgZ2wuYmluZFRleHR1cmUoR0wuVEVYVFVSRV8yRCwgdGV4X2JhY2tidWZmZXIpO1xuICAgIGdsLmFjdGl2ZVRleHR1cmUoR0wuVEVYVFVSRTEpO1xuICAgIGdsLmJpbmRUZXh0dXJlKEdMLlRFWFRVUkVfMkQsIGFjY3VtX2NweS50ZXgpO1xuICAgIGdsLmRyYXdBcnJheXMoR0wuVFJJQU5HTEVfRkFOLCAwLCA0KTtcbiAgICB1bmJpbmQoR0wuVEVYVFVSRTAsIEdMLlRFWFRVUkUxLCBHTC5BUlJBWV9CVUZGRVIsIEdMLkZSQU1FQlVGRkVSKTtcblxuICAgIC8qIGFkZCBzbGlnaHQgYmx1ciB0byBiYWNrYnVmZmVyOyBhY2N1bV9idWYgPSBibHVyKGFjY3VtX2J1ZikgKi9cbiAgICBkcmF3Qmx1cihhY2N1bV9idWYudGV4LCBhY2N1bV9idWYuZmJvLCBibHVyX3RtcCwgMC4xNywgZHcsIGRoKTtcblxuICAgIC8qIGNyZWF0ZSBmdWxseSBibHVycmVkIHZlcnNpb24gb2YgYmFja2J1ZmZlcjsgYmx1cl9idWYgPSBibHVyKGFjY3VtX2J1ZikgKi9cbiAgICBkcmF3Qmx1cihhY2N1bV9idWYudGV4LCBibHVyX2J1Zi5mYm8sIGJsdXJfdG1wLCAxLjAsIGR3LCBkaCk7XG5cbiAgICAvKiBlbnN1cmUgY3J0IGNhbnZhcyBvdmVybGF5cyB0YXJnZXRDYW52YXMgKi9cbiAgICBnbC52aWV3cG9ydCgwLCAwLCBjdywgY2gpO1xuXG4gICAgLyogYXBwbHkgY3J0IHNoYWRlcjsgY2FudmFzID0gY3J0KGFjY3VtX2J1ZiwgYmx1cl9idWYpICovXG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKEdMLkZSQU1FQlVGRkVSLCBudWxsKTtcbiAgICBnbC51c2VQcm9ncmFtKGNydF9wcm9ncmFtKTtcbiAgICBiaW5kVmVydGV4QnVmZmVyKGxvY19jcnRfcG9zKTtcbiAgICBnbC5hY3RpdmVUZXh0dXJlKEdMLlRFWFRVUkUwKTtcbiAgICBnbC5iaW5kVGV4dHVyZShHTC5URVhUVVJFXzJELCBhY2N1bV9idWYudGV4KTtcbiAgICBnbC5hY3RpdmVUZXh0dXJlKEdMLlRFWFRVUkUxKTtcbiAgICBnbC5iaW5kVGV4dHVyZShHTC5URVhUVVJFXzJELCBibHVyX2J1Zi50ZXgpO1xuICAgIGdsLnVuaWZvcm0yZihsb2NfY3J0X3Jlc29sdXRpb24sIGN3LCBjaCk7XG4gICAgZ2wudW5pZm9ybTFmKGxvY19jcnRfdGltZSwgMS41ICogdGltZSk7XG4gICAgZ2wudW5pZm9ybTFpKGxvY19jcnRfYmFja2J1ZmZlciwgMCk7XG4gICAgZ2wudW5pZm9ybTFpKGxvY19jcnRfYmx1cmJ1ZmZlciwgMSk7XG4gICAgZ2wuZHJhd0FycmF5cyhHTC5UUklBTkdMRV9GQU4sIDAsIDQpO1xuICAgIHVuYmluZChHTC5URVhUVVJFMCwgR0wuVEVYVFVSRTEsIEdMLkFSUkFZX0JVRkZFUiwgR0wuRlJBTUVCVUZGRVIpO1xuXG4gICAgbGFzdER3ID0gZHc7XG4gICAgbGFzdERoID0gZGg7XG4gIH07XG59O1xuXG5leHBvcnQgeyBpbml0UmVuZGVyZXIgfTtcbiIsImltcG9ydCB7IFN0YWdlIH0gZnJvbSBcIi4vc3RhZ2VcIjtcblxuaW50ZXJmYWNlIERpc3BsYXlPYmplY3Qge1xuICBzdGFnZT86IFN0YWdlO1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgd2lkdGg6IG51bWJlcjtcbiAgaGVpZ2h0OiBudW1iZXI7XG4gIGJvcmRlclNpemU6IG51bWJlcjtcbiAgcGl2b3RYOiBudW1iZXI7XG4gIHBpdm90WTogbnVtYmVyO1xuICByb3RhdGlvbjogbnVtYmVyO1xuICBhbHBoYTogbnVtYmVyO1xuICBzY2FsZVg6IG51bWJlcjtcbiAgc2NhbGVZOiBudW1iZXI7XG4gIHNrZXdYOiBudW1iZXI7XG4gIHNrZXdZOiBudW1iZXI7XG5cbiAgaW5pdCgpOiB2b2lkO1xuICB1cGRhdGUoZHQ6IG51bWJlcik6IHZvaWQ7XG4gIHJlbmRlcihjb250ZXh0OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQpOiB2b2lkO1xuICBkZXN0cm95KCk6IHZvaWQ7XG5cbiAgZ2V0R2xvYmFsWCgpOiBudW1iZXI7XG4gIGdldEdsb2JhbFkoKTogbnVtYmVyO1xuICBnZXRIYWxmV2lkdGgoKTogbnVtYmVyO1xuICBnZXRIYWxmSGVpZ2h0KCk6IG51bWJlcjtcbiAgZ2V0Q2VudGVyWCgpOiBudW1iZXI7XG4gIGdldENlbnRlclkoKTogbnVtYmVyO1xufVxuXG50eXBlIERpc3BsYXlPYmplY3RQcm9wcyA9IFBhcnRpYWw8e1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgYm9yZGVyU2l6ZTogbnVtYmVyO1xuICBwaXZvdFg6IG51bWJlcjtcbiAgcGl2b3RZOiBudW1iZXI7XG4gIHJvdGF0aW9uOiBudW1iZXI7XG4gIGFscGhhOiBudW1iZXI7XG4gIHNjYWxlWDogbnVtYmVyO1xuICBzY2FsZVk6IG51bWJlcjtcbiAgc2tld1g6IG51bWJlcjtcbiAgc2tld1k6IG51bWJlcjtcbn0+O1xuXG5jb25zdCBjcmVhdGVEaXNwbGF5T2JqZWN0ID0gKFxuICB3aWR0aDogbnVtYmVyLFxuICBoZWlnaHQ6IG51bWJlcixcbiAgcmVuZGVyOiAoY29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEKSA9PiB2b2lkLFxuICBwcm9wcz86IERpc3BsYXlPYmplY3RQcm9wc1xuKTogRGlzcGxheU9iamVjdCA9PiB7XG4gIGNvbnN0IG9iajogRGlzcGxheU9iamVjdCA9IHtcbiAgICB4OiAwLFxuICAgIHk6IDAsXG4gICAgd2lkdGgsXG4gICAgaGVpZ2h0LFxuICAgIGJvcmRlclNpemU6IDAsXG4gICAgcGl2b3RYOiAwLFxuICAgIHBpdm90WTogMCxcbiAgICByb3RhdGlvbjogMCxcbiAgICBhbHBoYTogMSxcbiAgICBzY2FsZVg6IDEsXG4gICAgc2NhbGVZOiAxLFxuICAgIHNrZXdYOiAwLFxuICAgIHNrZXdZOiAwLFxuICAgIGluaXQoKSB7fSxcbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge30sXG4gICAgcmVuZGVyLFxuICAgIGRlc3Ryb3koKSB7fSxcbiAgICBnZXRHbG9iYWxYKCk6IG51bWJlciB7XG4gICAgICByZXR1cm4gb2JqLnN0YWdlID8gb2JqLnggKyBvYmouc3RhZ2UuZ2V0R2xvYmFsWCgpIDogb2JqLng7XG4gICAgfSxcbiAgICBnZXRHbG9iYWxZKCk6IG51bWJlciB7XG4gICAgICByZXR1cm4gb2JqLnN0YWdlID8gb2JqLnkgKyBvYmouc3RhZ2UuZ2V0R2xvYmFsWSgpIDogb2JqLnk7XG4gICAgfSxcbiAgICBnZXRIYWxmV2lkdGgoKTogbnVtYmVyIHtcbiAgICAgIHJldHVybiBvYmoud2lkdGggLyAyO1xuICAgIH0sXG4gICAgZ2V0SGFsZkhlaWdodCgpOiBudW1iZXIge1xuICAgICAgcmV0dXJuIG9iai5oZWlnaHQgLyAyO1xuICAgIH0sXG4gICAgZ2V0Q2VudGVyWCgpOiBudW1iZXIge1xuICAgICAgcmV0dXJuIG9iai54ICsgb2JqLmdldEhhbGZXaWR0aCgpO1xuICAgIH0sXG4gICAgZ2V0Q2VudGVyWSgpOiBudW1iZXIge1xuICAgICAgcmV0dXJuIG9iai55ICsgb2JqLmdldEhhbGZIZWlnaHQoKTtcbiAgICB9LFxuICAgIC4uLnByb3BzXG4gIH07XG4gIGlmIChwcm9wcykgb2JqLmluaXQoKTtcblxuICByZXR1cm4gb2JqO1xufTtcblxuZXhwb3J0IHsgRGlzcGxheU9iamVjdCwgRGlzcGxheU9iamVjdFByb3BzLCBjcmVhdGVEaXNwbGF5T2JqZWN0IH07XG4iLCJpbXBvcnQgeyBjcmVhdGVEaXNwbGF5T2JqZWN0LCBEaXNwbGF5T2JqZWN0LCBEaXNwbGF5T2JqZWN0UHJvcHMgfSBmcm9tIFwiLi9kaXNwbGF5XCI7XG5cbmludGVyZmFjZSBTdGFnZSBleHRlbmRzIERpc3BsYXlPYmplY3Qge1xuICBjaGlsZHJlbjogQXJyYXk8RGlzcGxheU9iamVjdD47XG4gIGhhc0NoaWxkcmVuKCk6IGJvb2xlYW47XG4gIGFkZENoaWxkKG9iajogRGlzcGxheU9iamVjdCk6IHZvaWQ7XG4gIHJlbW92ZUNoaWxkKG9iajogRGlzcGxheU9iamVjdCk6IHZvaWQ7XG4gIGFkZE1hbnkoLi4uYWxsOiBBcnJheTxEaXNwbGF5T2JqZWN0Pik6IHZvaWQ7XG4gIHJlbW92ZUFsbCgpOiB2b2lkO1xufVxuXG50eXBlIFN0YWdlUHJvcHMgPSBEaXNwbGF5T2JqZWN0UHJvcHM7XG5cbmNvbnN0IGNyZWF0ZVN0YWdlID0gKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBwcm9wcz86IFN0YWdlUHJvcHMpOiBTdGFnZSA9PiB7XG4gIGNvbnN0IHN0YWdlOiBTdGFnZSA9IE9iamVjdC5hc3NpZ24oXG4gICAgY3JlYXRlRGlzcGxheU9iamVjdCh3aWR0aCwgaGVpZ2h0LCAoY3R4KSA9PiB7XG4gICAgICBzdGFnZS5jaGlsZHJlbi5mb3JFYWNoKChvYmopID0+IHtcbiAgICAgICAgY3R4LnNhdmUoKTtcblxuICAgICAgICBjdHgudHJhbnNsYXRlKFxuICAgICAgICAgIHN0YWdlLnggKyBvYmoueCAtIG9iai5ib3JkZXJTaXplICsgKG9iai53aWR0aCArIG9iai5ib3JkZXJTaXplICogMikgKiBvYmoucGl2b3RYLFxuICAgICAgICAgIHN0YWdlLnkgKyBvYmoueSAtIG9iai5ib3JkZXJTaXplICsgKG9iai5oZWlnaHQgKyBvYmouYm9yZGVyU2l6ZSAqIDIpICogb2JqLnBpdm90WVxuICAgICAgICApO1xuICAgICAgICBjdHgucm90YXRlKG9iai5yb3RhdGlvbik7XG4gICAgICAgIGN0eC5nbG9iYWxBbHBoYSA9IG9iai5hbHBoYSAqIHN0YWdlLmFscGhhO1xuICAgICAgICBjdHguc2NhbGUob2JqLnNjYWxlWCwgb2JqLnNjYWxlWSk7XG5cbiAgICAgICAgb2JqLnJlbmRlcihjdHgpO1xuXG4gICAgICAgIGN0eC5yZXN0b3JlKCk7XG4gICAgICB9KTtcbiAgICB9KSxcbiAgICB7XG4gICAgICBjaGlsZHJlbjogW10sXG4gICAgICBhZGRDaGlsZChvYmo6IERpc3BsYXlPYmplY3QpIHtcbiAgICAgICAgb2JqLnN0YWdlID0gc3RhZ2U7XG4gICAgICAgIHN0YWdlLmNoaWxkcmVuLnB1c2gob2JqKTtcbiAgICAgIH0sXG4gICAgICByZW1vdmVDaGlsZChvYmo6IERpc3BsYXlPYmplY3QpIHtcbiAgICAgICAgaWYgKHN0YWdlLmNoaWxkcmVuLmluZGV4T2Yob2JqKSA8IDApIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oXCJbU3RhZ2VdIFRyeWluZyB0byBkZWxldGUgb2RkIGNoaWxkXCIsIG9iaik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhZ2UuY2hpbGRyZW4uc3BsaWNlKHN0YWdlLmNoaWxkcmVuLmluZGV4T2Yob2JqKSwgMSk7XG4gICAgICAgIG9iai5zdGFnZSA9IHVuZGVmaW5lZDtcbiAgICAgIH0sXG4gICAgICBhZGRNYW55KC4uLmFsbDogRGlzcGxheU9iamVjdFtdKSB7XG4gICAgICAgIGFsbC5mb3JFYWNoKChvYmopID0+IG9iaiAmJiBzdGFnZS5hZGRDaGlsZChvYmopKTtcbiAgICAgIH0sXG4gICAgICByZW1vdmVBbGwoKSB7XG4gICAgICAgIHN0YWdlLmNoaWxkcmVuLmZvckVhY2goKGNoaWxkKSA9PiAoY2hpbGQuc3RhZ2UgPSB1bmRlZmluZWQpKTtcbiAgICAgICAgc3RhZ2UuY2hpbGRyZW4gPSBbXTtcbiAgICAgIH0sXG4gICAgICBoYXNDaGlsZHJlbigpIHtcbiAgICAgICAgcmV0dXJuIHN0YWdlLmNoaWxkcmVuLmxlbmd0aCA+IDA7XG4gICAgICB9LFxuICAgICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcbiAgICAgICAgc3RhZ2UuY2hpbGRyZW4uZm9yRWFjaCgob2JqKSA9PiB7XG4gICAgICAgICAgb2JqLnVwZGF0ZShkdCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgcHJvcHNcbiAgKTtcbiAgaWYgKHByb3BzKSBzdGFnZS5pbml0KCk7XG4gIHJldHVybiBzdGFnZTtcbn07XG5cbmV4cG9ydCB7IFN0YWdlLCBTdGFnZVByb3BzLCBjcmVhdGVTdGFnZSB9O1xuIiwidHlwZSBVcGRhdGVUd2VlbiA9ICgpID0+IHZvaWQ7XG5cbmNvbnN0IHNtb290aHN0ZXAgPSAoeDogbnVtYmVyKSA9PiB4ICogeCAqICgzIC0gMiAqIHgpO1xuXG5jb25zdCBzaW5lID0gKHg6IG51bWJlcikgPT4gTWF0aC5zaW4oKHggKiBNYXRoLlBJKSAvIDIpO1xuXG5jb25zdCBlYXNlT3V0QmFjayA9ICh4OiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICBjb25zdCBjMSA9IDEuNzAxNTgsXG4gICAgYzMgPSBjMSArIDE7XG4gIHJldHVybiAxICsgYzMgKiBNYXRoLnBvdyh4IC0gMSwgMykgKyBjMSAqIE1hdGgucG93KHggLSAxLCAyKTtcbn07XG5cbmNvbnN0IHR3ZWVuczogQXJyYXk8VXBkYXRlVHdlZW4+ID0gW107XG5cbmNvbnN0IHR3ZWVuUHJvcCA9IChcbiAgdG90YWxGcmFtZXM6IG51bWJlcixcbiAgc3RhcnRWYWx1ZTogbnVtYmVyLFxuICBlbmRWYWx1ZTogbnVtYmVyLFxuICBlYXNlOiAoeDogbnVtYmVyKSA9PiBudW1iZXIsXG4gIHVwZGF0ZTogKHg6IG51bWJlcikgPT4gdm9pZCxcbiAgb25Db21wbGV0ZT86ICgpID0+IHZvaWRcbik6IHZvaWQgPT4ge1xuICBsZXQgZnJhbWVDb3VudGVyID0gMDtcbiAgY29uc3QgdHdlZW4gPSAoKSA9PiB7XG4gICAgaWYgKGZyYW1lQ291bnRlciA8IHRvdGFsRnJhbWVzKSB7XG4gICAgICBjb25zdCBub3JtYWxpemVkVGltZSA9IGZyYW1lQ291bnRlciAvIHRvdGFsRnJhbWVzLFxuICAgICAgICBjdXJ2ZWRUaW1lID0gZWFzZShub3JtYWxpemVkVGltZSk7XG4gICAgICB1cGRhdGUoZW5kVmFsdWUgKiBjdXJ2ZWRUaW1lICsgc3RhcnRWYWx1ZSAqICgxIC0gY3VydmVkVGltZSkpO1xuICAgICAgZnJhbWVDb3VudGVyICs9IDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvbkNvbXBsZXRlKSBvbkNvbXBsZXRlKCk7XG4gICAgICB0d2VlbnMuc3BsaWNlKHR3ZWVucy5pbmRleE9mKHR3ZWVuKSwgMSk7XG4gICAgfVxuICB9O1xuICB0d2VlbnMucHVzaCh0d2Vlbik7XG59O1xuXG5jb25zdCB1cGRhdGVUd2VlbnMgPSAoZHQ6IG51bWJlcikgPT4ge1xuICBpZiAodHdlZW5zLmxlbmd0aCA+IDApIHtcbiAgICBmb3IgKGxldCB1cGRhdGVUd2VlbjogVXBkYXRlVHdlZW4sIGkgPSB0d2VlbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHVwZGF0ZVR3ZWVuID0gdHdlZW5zW2ldO1xuICAgICAgaWYgKHVwZGF0ZVR3ZWVuKSB1cGRhdGVUd2VlbigpO1xuICAgIH1cbiAgfVxufTtcblxuZXhwb3J0IHsgc21vb3Roc3RlcCwgc2luZSwgZWFzZU91dEJhY2ssIHR3ZWVuUHJvcCwgdXBkYXRlVHdlZW5zIH07XG4iLCJpbXBvcnQgeyBjcmVhdGVEaXNwbGF5T2JqZWN0LCBEaXNwbGF5T2JqZWN0LCBEaXNwbGF5T2JqZWN0UHJvcHMgfSBmcm9tIFwiLi9kaXNwbGF5XCI7XG5cbmludGVyZmFjZSBTcHJpdGUgZXh0ZW5kcyBEaXNwbGF5T2JqZWN0IHtcbiAgcmVhZG9ubHkgaW1hZ2U6IENhbnZhc0ltYWdlU291cmNlO1xuICBzZXRJbWFnZShpbWFnZTogQ2FudmFzSW1hZ2VTb3VyY2UpOiB2b2lkO1xufVxuXG50eXBlIFNwcml0ZVByb3BzID0gRGlzcGxheU9iamVjdFByb3BzO1xuXG5jb25zdCBjcmVhdGVTcHJpdGUgPSAoaW1hZ2U6IENhbnZhc0ltYWdlU291cmNlLCBwcm9wcz86IFNwcml0ZVByb3BzKTogU3ByaXRlID0+IHtcbiAgbGV0IGltYWdlV2lkdGggPSA8bnVtYmVyPmltYWdlLndpZHRoO1xuICBsZXQgaW1hZ2VIZWlnaHQgPSA8bnVtYmVyPmltYWdlLmhlaWdodDtcblxuICBjb25zdCBzcHJpdGU6IFNwcml0ZSA9IE9iamVjdC5hc3NpZ24oXG4gICAgY3JlYXRlRGlzcGxheU9iamVjdChpbWFnZVdpZHRoLCBpbWFnZUhlaWdodCwgKGN0eCkgPT4ge1xuICAgICAgY3R4LnRyYW5zZm9ybSgxLCBzcHJpdGUuc2tld1ksIHNwcml0ZS5za2V3WCwgMSwgMCwgMCk7XG4gICAgICBjdHguZHJhd0ltYWdlKFxuICAgICAgICBzcHJpdGUuaW1hZ2UsXG4gICAgICAgIDAsXG4gICAgICAgIDAsXG4gICAgICAgIGltYWdlV2lkdGgsXG4gICAgICAgIGltYWdlSGVpZ2h0LFxuICAgICAgICAtaW1hZ2VXaWR0aCAqIHNwcml0ZS5waXZvdFgsXG4gICAgICAgIC1pbWFnZUhlaWdodCAqIHNwcml0ZS5waXZvdFksXG4gICAgICAgIGltYWdlV2lkdGgsXG4gICAgICAgIGltYWdlSGVpZ2h0XG4gICAgICApO1xuICAgIH0pLFxuICAgIHtcbiAgICAgIGltYWdlLFxuICAgICAgc2V0SW1hZ2UoaW1hZ2U6IENhbnZhc0ltYWdlU291cmNlKSB7XG4gICAgICAgIGltYWdlV2lkdGggPSA8bnVtYmVyPmltYWdlLndpZHRoO1xuICAgICAgICBpbWFnZUhlaWdodCA9IDxudW1iZXI+aW1hZ2UuaGVpZ2h0O1xuXG4gICAgICAgIHRoaXMuaW1hZ2UgPSBpbWFnZTtcblxuICAgICAgICBzcHJpdGUud2lkdGggPSBpbWFnZVdpZHRoIC0gc3ByaXRlLmJvcmRlclNpemUgKiAyO1xuICAgICAgICBzcHJpdGUuaGVpZ2h0ID0gaW1hZ2VIZWlnaHQgLSBzcHJpdGUuYm9yZGVyU2l6ZSAqIDI7XG4gICAgICB9LFxuICAgICAgaW5pdCgpIHtcbiAgICAgICAgc3ByaXRlLndpZHRoIC09IHNwcml0ZS5ib3JkZXJTaXplICogMjtcbiAgICAgICAgc3ByaXRlLmhlaWdodCAtPSBzcHJpdGUuYm9yZGVyU2l6ZSAqIDI7XG4gICAgICB9XG4gICAgfSxcbiAgICBwcm9wc1xuICApO1xuICBpZiAocHJvcHMpIHNwcml0ZS5pbml0KCk7XG5cbiAgcmV0dXJuIHNwcml0ZTtcbn07XG5cbmV4cG9ydCB7IFNwcml0ZSwgU3ByaXRlUHJvcHMsIGNyZWF0ZVNwcml0ZSB9O1xuIiwiaW1wb3J0IHsgYXNzZXRzLCBUaWxlIH0gZnJvbSBcIi4vYXNzZXRzXCI7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gXCIuL2NvbG9yc1wiO1xuaW1wb3J0IHsgYWRkT3V0bGluZSwgY2FudmFzUG9vbCwgY29sb3JpemVJbWFnZSwgd3JhcENhbnZhc0Z1bmMgfSBmcm9tIFwiLi9jb3JlL2NhbnZhcy11dGlsc1wiO1xuaW1wb3J0IHsgY3JlYXRlU3ByaXRlLCBTcHJpdGUsIFNwcml0ZVByb3BzIH0gZnJvbSBcIi4vY29yZS9zcHJpdGVcIjtcblxuaW50ZXJmYWNlIENvbG9yZWRTcHJpdGUgZXh0ZW5kcyBTcHJpdGUge1xuICBjb2xvcjogQ29sb3I7XG4gIG91dGxpbmVTaXplOiBudW1iZXI7XG4gIG91dGxpbmVDb2xvcjogQ29sb3I7XG59XG5cbnR5cGUgQ29sb3JlZFNwcml0ZVByb3BzID0gUGFydGlhbDx7XG4gIG91dGxpbmVTaXplOiBudW1iZXI7XG4gIG91dGxpbmVDb2xvcjogQ29sb3I7XG59PiAmXG4gIFNwcml0ZVByb3BzO1xuXG5jb25zdCBjcmVhdGVDb2xvcmVkU3ByaXRlID0gKHRpbGU6IFRpbGUsIGNvbG9yOiBDb2xvciwgcHJvcHM/OiBDb2xvcmVkU3ByaXRlUHJvcHMpOiBDb2xvcmVkU3ByaXRlID0+IHtcbiAgY29uc3QgaW1hZ2UgPSBjb2xvcml6ZUltYWdlKGFzc2V0c1t0aWxlXSwgY29sb3IpO1xuXG4gIGNvbnN0IHNwcml0ZSA9IGNyZWF0ZVNwcml0ZShpbWFnZSk7XG4gIGNvbnN0IHN1cGVySW5pdCA9IHNwcml0ZS5pbml0O1xuICBjb25zdCBjb2xvclNwcml0ZTogQ29sb3JlZFNwcml0ZSA9IE9iamVjdC5hc3NpZ24oXG4gICAgc3ByaXRlLFxuICAgIHtcbiAgICAgIGNvbG9yLFxuICAgICAgb3V0bGluZVNpemU6IDAsXG4gICAgICBvdXRsaW5lQ29sb3I6IENvbG9yLkJyb3duRGFyayxcbiAgICAgIGluaXQoKSB7XG4gICAgICAgIGNvbnN0IHNvcyA9IGNvbG9yU3ByaXRlLm91dGxpbmVTaXplO1xuICAgICAgICBpZiAoc29zID4gMCkge1xuICAgICAgICAgIGNvbG9yU3ByaXRlLmJvcmRlclNpemUgKz0gc29zO1xuICAgICAgICAgIGNvbG9yU3ByaXRlLnNldEltYWdlKFxuICAgICAgICAgICAgd3JhcENhbnZhc0Z1bmMoYWRkT3V0bGluZSwgY29sb3JTcHJpdGUuaW1hZ2UgYXMgSFRNTENhbnZhc0VsZW1lbnQsIHNvcywgY29sb3JTcHJpdGUub3V0bGluZUNvbG9yKVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3VwZXJJbml0KCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZXN0cm95KCkge1xuICAgICAgICBjYW52YXNQb29sLmZyZWUoY29sb3JTcHJpdGUuaW1hZ2UgYXMgSFRNTENhbnZhc0VsZW1lbnQpO1xuICAgICAgfVxuICAgIH0sXG4gICAgcHJvcHNcbiAgKTtcbiAgaWYgKHByb3BzKSBjb2xvclNwcml0ZS5pbml0KCk7XG5cbiAgcmV0dXJuIGNvbG9yU3ByaXRlO1xufTtcblxuZXhwb3J0IHsgQ29sb3JlZFNwcml0ZSwgQ29sb3JlZFNwcml0ZVByb3BzLCBjcmVhdGVDb2xvcmVkU3ByaXRlIH07XG4iLCJpbXBvcnQgeyBEaXNwbGF5T2JqZWN0IH0gZnJvbSBcIi4vZGlzcGxheVwiO1xuXG5jb25zdCBlbnVtIENvbGxpc2lvblNpZGUge1xuICBUb3AsXG4gIEJvdHRvbSxcbiAgTGVmdCxcbiAgUmlnaHRcbn1cblxuY29uc3QgcmVjdGFuZ2xlQ29sbGlzaW9uID0gKFxuICBvYmoxOiBEaXNwbGF5T2JqZWN0ICYgeyB2eD86IG51bWJlcjsgdnk/OiBudW1iZXIgfSxcbiAgb2JqMjogRGlzcGxheU9iamVjdCxcbiAgYm91bmNlID0gZmFsc2Vcbik6IENvbGxpc2lvblNpZGUgfCB1bmRlZmluZWQgPT4ge1xuICBsZXQgY29sbGlzaW9uOiBDb2xsaXNpb25TaWRlIHwgdW5kZWZpbmVkO1xuICBsZXQgb3ZlcmxhcFg6IG51bWJlcjtcbiAgbGV0IG92ZXJsYXBZOiBudW1iZXI7XG5cbiAgLy8gVE9ETzogb3B0aW1pemVcbiAgY29uc3QgdnggPSBvYmoxLmdldEdsb2JhbFgoKSArIG9iajEuZ2V0SGFsZldpZHRoKCkgLSAob2JqMi5nZXRHbG9iYWxYKCkgKyBvYmoyLmdldEhhbGZXaWR0aCgpKTtcbiAgY29uc3QgdnkgPSBvYmoxLmdldEdsb2JhbFkoKSArIG9iajEuZ2V0SGFsZkhlaWdodCgpIC0gKG9iajIuZ2V0R2xvYmFsWSgpICsgb2JqMi5nZXRIYWxmSGVpZ2h0KCkpO1xuICBjb25zdCBjb21iaW5lZEhhbGZXaWR0aHMgPSBvYmoxLmdldEhhbGZXaWR0aCgpICsgb2JqMi5nZXRIYWxmV2lkdGgoKTtcbiAgY29uc3QgY29tYmluZWRIYWxmSGVpZ2h0cyA9IG9iajEuZ2V0SGFsZkhlaWdodCgpICsgb2JqMi5nZXRIYWxmSGVpZ2h0KCk7XG5cbiAgaWYgKE1hdGguYWJzKHZ4KSA8IGNvbWJpbmVkSGFsZldpZHRocykge1xuICAgIGlmIChNYXRoLmFicyh2eSkgPCBjb21iaW5lZEhhbGZIZWlnaHRzKSB7XG4gICAgICBvdmVybGFwWCA9IGNvbWJpbmVkSGFsZldpZHRocyAtIE1hdGguYWJzKHZ4KTtcbiAgICAgIG92ZXJsYXBZID0gY29tYmluZWRIYWxmSGVpZ2h0cyAtIE1hdGguYWJzKHZ5KTtcbiAgICAgIGlmIChvdmVybGFwWCA+PSBvdmVybGFwWSkge1xuICAgICAgICBpZiAodnkgPiAwKSB7XG4gICAgICAgICAgY29sbGlzaW9uID0gQ29sbGlzaW9uU2lkZS5Ub3A7XG4gICAgICAgICAgb2JqMS55ID0gb2JqMS55ICsgb3ZlcmxhcFk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29sbGlzaW9uID0gQ29sbGlzaW9uU2lkZS5Cb3R0b207XG4gICAgICAgICAgb2JqMS55ID0gb2JqMS55IC0gb3ZlcmxhcFk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJvdW5jZSAmJiBvYmoxLnZ5KSBvYmoxLnZ5ICo9IC0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHZ4ID4gMCkge1xuICAgICAgICAgIGNvbGxpc2lvbiA9IENvbGxpc2lvblNpZGUuTGVmdDtcbiAgICAgICAgICBvYmoxLnggPSBvYmoxLnggKyBvdmVybGFwWDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb2xsaXNpb24gPSBDb2xsaXNpb25TaWRlLlJpZ2h0O1xuICAgICAgICAgIG9iajEueCA9IG9iajEueCAtIG92ZXJsYXBYO1xuICAgICAgICB9XG4gICAgICAgIGlmIChib3VuY2UgJiYgb2JqMS52eCkgb2JqMS52eCAqPSAtMTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbGxpc2lvbjtcbn07XG5cbmNvbnN0IGhpdFRlc3RSZWN0YW5nbGUgPSAob2JqMTogRGlzcGxheU9iamVjdCwgb2JqMjogRGlzcGxheU9iamVjdCk6IGJvb2xlYW4gPT5cbiAgb2JqMS54IDwgb2JqMi54ICsgb2JqMi53aWR0aCAmJlxuICBvYmoxLnggKyBvYmoxLndpZHRoID4gb2JqMi54ICYmXG4gIG9iajEueSA8IG9iajIueSArIG9iajIuaGVpZ2h0ICYmXG4gIG9iajEueSArIG9iajEuaGVpZ2h0ID4gb2JqMi55O1xuXG5leHBvcnQgeyBDb2xsaXNpb25TaWRlLCByZWN0YW5nbGVDb2xsaXNpb24sIGhpdFRlc3RSZWN0YW5nbGUgfTtcbiIsImNvbnN0IHp6Zng9KC4uLnQpPT56emZ4UCh6emZ4RyguLi50KSksXG4gIHp6ZnhQPSguLi50KT0+e2xldCBlPXp6ZnhYLmNyZWF0ZUJ1ZmZlclNvdXJjZSgpLGY9enpmeFguY3JlYXRlQnVmZmVyKHQubGVuZ3RoLHRbMF0ubGVuZ3RoLHp6ZnhSKTt0Lm1hcCgoZCxpKT0+Zi5nZXRDaGFubmVsRGF0YShpKS5zZXQoZCkpLGUuYnVmZmVyPWYsZS5jb25uZWN0KHp6ZnhYLmRlc3RpbmF0aW9uKSxlLnN0YXJ0KCk7cmV0dXJuIGV9LFxuICB6emZ4Rz0ocT0xLGs9LjA1LGM9MjIwLGU9MCx0PTAsdT0uMSxyPTAsRj0xLHY9MCx6PTAsdz0wLEE9MCxsPTAsQj0wLHg9MCxHPTAsZD0wLHk9MSxtPTAsQz0wKT0+e2xldCBiPTIqTWF0aC5QSSxIPXYqPTUwMCpiL3p6ZnhSKioyLEk9KDA8eD8xOi0xKSpiLzQsRD1jKj0oMSsyKmsqTWF0aC5yYW5kb20oKS1rKSpiL3p6ZnhSLFo9W10sZz0wLEU9MCxhPTAsbj0xLEo9MCxLPTAsZj0wLHAsaDtlPTk5K3p6ZnhSKmU7bSo9enpmeFI7dCo9enpmeFI7dSo9enpmeFI7ZCo9enpmeFI7eio9NTAwKmIvenpmeFIqKjM7eCo9Yi96emZ4Ujt3Kj1iL3p6ZnhSO0EqPXp6ZnhSO2w9enpmeFIqbHwwO2ZvcihoPWUrbSt0K3UrZHwwO2E8aDtaW2ErK109ZikrK0slKDEwMCpHfDApfHwoZj1yPzE8cj8yPHI/MzxyP01hdGguc2luKChnJWIpKiozKTpNYXRoLm1heChNYXRoLm1pbihNYXRoLnRhbihnKSwxKSwtMSk6MS0oMipnL2IlMisyKSUyOjEtNCpNYXRoLmFicyhNYXRoLnJvdW5kKGcvYiktZy9iKTpNYXRoLnNpbihnKSxmPShsPzEtQytDKk1hdGguc2luKDIqTWF0aC5QSSphL2wpOjEpKigwPGY/MTotMSkqTWF0aC5hYnMoZikqKkYqcSp6emZ4ViooYTxlP2EvZTphPGUrbT8xLShhLWUpL20qKDEteSk6YTxlK20rdD95OmE8aC1kPyhoLWEtZCkvdSp5OjApLGY9ZD9mLzIrKGQ+YT8wOihhPGgtZD8xOihoLWEpL2QpKlpbYS1kfDBdLzIpOmYpLHA9KGMrPXYrPXopKk1hdGguc2luKEUqeC1JKSxnKz1wLXAqQiooMS0xRTkqKE1hdGguc2luKGEpKzEpJTIpLEUrPXAtcCpCKigxLTFFOSooTWF0aC5zaW4oYSkqKjIrMSklMiksbiYmKytuPkEmJihjKz13LEQrPXcsbj0wKSwhbHx8KytKJWx8fChjPUQsdj1ILG49bnx8MSk7cmV0dXJuIFp9LFxuICB6emZ4Vj0uMyxcbiAgenpmeFI9NDQxMDAsXG4gIHp6ZnhYPW5ldyh3aW5kb3cuQXVkaW9Db250ZXh0fHx3ZWJraXRBdWRpb0NvbnRleHQpLFxuICB6emZ4TT0obixmLHQsZT0xMjUpPT57bGV0IGwsbyx6LHIsZyxoLHgsYSx1LGMsZCxpLG0scCxHLE09MCxSPVtdLGI9W10saj1bXSxrPTAscT0wLHM9MSx2PXt9LHc9enpmeFIvZSo2MD4+Mjtmb3IoO3M7aysrKVI9W3M9YT1kPW09MF0sdC5tYXAoKGUsZCk9Pntmb3IoeD1mW2VdW2tdfHxbMCwwLDBdLHN8PSEhZltlXVtrXSxHPW0rKGZbZV1bMF0ubGVuZ3RoLTItIWEpKncscD1kPT10Lmxlbmd0aC0xLG89MixyPW07bzx4Lmxlbmd0aCtwO2E9KytvKXtmb3IoZz14W29dLHU9bz09eC5sZW5ndGgrcC0xJiZwfHxjIT0oeFswXXx8MCl8Z3wwLHo9MDt6PHcmJmE7eisrPnctOTkmJnU/aSs9KGk8MSkvOTk6MCloPSgxLWkpKlJbTSsrXS8yfHwwLGJbcl09KGJbcl18fDApLWgqcStoLGpbcl09KGpbcisrXXx8MCkraCpxK2g7ZyYmKGk9ZyUxLHE9eFsxXXx8MCwoZ3w9MCkmJihSPXZbW2M9eFtNPTBdfHwwLGddXT12W1tjLGddXXx8KGw9Wy4uLm5bY11dLGxbMl0qPTIqKigoZy0xMikvMTIpLGc+MD96emZ4RyguLi5sKTpbXSkpKX1tPUd9KTtyZXR1cm5bYixqXX1cbmV4cG9ydCB7IHp6ZngsIHp6ZnhNLCB6emZ4UCwgenpmeFggfTtcblxuIiwiaW1wb3J0IHsgenpmeFggYXMgYXVkaW9Db250ZXh0IH0gZnJvbSBcIi4venpmeFwiO1xuXG5jb25zdCB1bmxvY2tBdWRpbyA9IChmb3JjZSA9IGZhbHNlKSA9PiB7XG4gIGlmIChmb3JjZSB8fCBhdWRpb0NvbnRleHQuc3RhdGUgPT09IFwic3VzcGVuZGVkXCIpIHtcbiAgICBhdWRpb0NvbnRleHQucmVzdW1lKCkuY2F0Y2goKTtcbiAgfVxufTtcblxuZXhwb3J0IHsgYXVkaW9Db250ZXh0LCB1bmxvY2tBdWRpbyB9O1xuIiwiaW1wb3J0IHsgdW5sb2NrQXVkaW8gfSBmcm9tIFwiLi9zb3VuZC9hdWRpb1wiO1xuXG5jb25zdCBLRVlfTEVGVCA9IDM3O1xuY29uc3QgS0VZX1JJR0hUID0gMzk7XG5jb25zdCBLRVlfVVAgPSAzODtcbmNvbnN0IEtFWV9ET1dOID0gNDA7XG5jb25zdCBTUEFDRSA9IDMyO1xuY29uc3QgRU5URVIgPSAxMztcblxubGV0IGlzTGVmdEtleURvd24gPSBmYWxzZTtcbmxldCBpc1JpZ2h0S2V5RG93biA9IGZhbHNlO1xubGV0IGlzVXBLZXlEb3duID0gZmFsc2U7XG5sZXQgaXNEb3duS2V5RG93biA9IGZhbHNlO1xubGV0IGlzU3BhY2VEb3duID0gZmFsc2U7XG5cbm9ua2V5ZG93biA9IChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICB1bmxvY2tBdWRpbygpO1xuXG4gIGNvbnN0IHsga2V5Q29kZSB9ID0gZXZlbnQ7XG4gIGlmIChrZXlDb2RlID09PSBLRVlfTEVGVCkge1xuICAgIGlzTGVmdEtleURvd24gPSB0cnVlO1xuICB9XG4gIGlmIChrZXlDb2RlID09PSBLRVlfUklHSFQpIHtcbiAgICBpc1JpZ2h0S2V5RG93biA9IHRydWU7XG4gIH1cbiAgaWYgKGtleUNvZGUgPT09IEtFWV9VUCkge1xuICAgIGlzVXBLZXlEb3duID0gdHJ1ZTtcbiAgfVxuICBpZiAoa2V5Q29kZSA9PT0gS0VZX0RPV04pIHtcbiAgICBpc0Rvd25LZXlEb3duID0gdHJ1ZTtcbiAgfVxuICBpZiAoa2V5Q29kZSA9PT0gU1BBQ0UpIHtcbiAgICBpc1NwYWNlRG93biA9IHRydWU7XG4gIH1cbn07XG5cbm9ua2V5dXAgPSAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgY29uc3QgeyBrZXlDb2RlIH0gPSBldmVudDtcbiAgaWYgKGtleUNvZGUgPT09IEtFWV9MRUZUKSB7XG4gICAgaXNMZWZ0S2V5RG93biA9IGZhbHNlO1xuICB9XG4gIGlmIChrZXlDb2RlID09PSBLRVlfUklHSFQpIHtcbiAgICBpc1JpZ2h0S2V5RG93biA9IGZhbHNlO1xuICB9XG4gIGlmIChrZXlDb2RlID09PSBLRVlfVVApIHtcbiAgICBpc1VwS2V5RG93biA9IGZhbHNlO1xuICB9XG4gIGlmIChrZXlDb2RlID09PSBLRVlfRE9XTikge1xuICAgIGlzRG93bktleURvd24gPSBmYWxzZTtcbiAgfVxuICBpZiAoa2V5Q29kZSA9PT0gU1BBQ0UpIHtcbiAgICBpc1NwYWNlRG93biA9IGZhbHNlO1xuICB9XG59O1xuXG50eXBlIEtleSA9IHtcbiAgY29kZTogbnVtYmVyO1xuICBpc0Rvd246IGJvb2xlYW47XG4gIGlzVXA6IGJvb2xlYW47XG4gIHByZXNzPzogKCkgPT4gdm9pZDtcbiAgcmVsZWFzZT86ICgpID0+IHZvaWQ7XG4gIGRvd25IYW5kbGVyOiAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHZvaWQ7XG4gIHVwSGFuZGxlcjogKGV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB2b2lkO1xufTtcblxuY29uc3QgYmluZEtleSA9IChrZXlDb2RlOiBudW1iZXIpOiBLZXkgPT4ge1xuICBjb25zdCBrZXk6IEtleSA9IHtcbiAgICBjb2RlOiBrZXlDb2RlLFxuICAgIGlzRG93bjogZmFsc2UsXG4gICAgaXNVcDogZmFsc2UsXG4gICAgZG93bkhhbmRsZXI6IChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IGtleS5jb2RlKSB7XG4gICAgICAgIGlmIChrZXkuaXNVcCAmJiBrZXkucHJlc3MpIGtleS5wcmVzcygpO1xuICAgICAgICBrZXkuaXNEb3duID0gdHJ1ZTtcbiAgICAgICAga2V5LmlzVXAgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIC8vIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgfSxcbiAgICB1cEhhbmRsZXI6IChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IGtleS5jb2RlKSB7XG4gICAgICAgIGlmIChrZXkuaXNEb3duICYmIGtleS5yZWxlYXNlKSBrZXkucmVsZWFzZSgpO1xuICAgICAgICBrZXkuaXNEb3duID0gZmFsc2U7XG4gICAgICAgIGtleS5pc1VwID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIC8vIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuICB9O1xuICBhZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBrZXkuZG93bkhhbmRsZXIuYmluZChrZXkpKTtcbiAgYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIGtleS51cEhhbmRsZXIuYmluZChrZXkpKTtcbiAgcmV0dXJuIGtleTtcbn07XG5cbmV4cG9ydCB7XG4gIGlzTGVmdEtleURvd24sXG4gIGlzUmlnaHRLZXlEb3duLFxuICBpc1VwS2V5RG93bixcbiAgaXNEb3duS2V5RG93bixcbiAgaXNTcGFjZURvd24sXG4gIEtFWV9MRUZULFxuICBLRVlfUklHSFQsXG4gIEtFWV9VUCxcbiAgS0VZX0RPV04sXG4gIFNQQUNFLFxuICBFTlRFUixcbiAgYmluZEtleVxufTtcbiIsImNvbnN0IGNyZWF0ZVBSTkcgPSAoc2VlZCA9IDEpID0+IHtcbiAgY29uc3QgZ2VuID0gKCkgPT4gKHNlZWQgPSAoc2VlZCAqIDE2ODA3KSAlIDIxNDc0ODM2NDcpO1xuICBjb25zdCBuZXh0SW50ID0gKCkgPT4gZ2VuKCk7XG4gIGNvbnN0IG5leHREb3VibGUgPSAoKSA9PiBnZW4oKSAvIDIxNDc0ODM2NDc7XG4gIGNvbnN0IG5leHRCb29sZWFuID0gKCkgPT4gZ2VuKCkgJSAyID09PSAwO1xuICBjb25zdCBuZXh0SW50UmFuZ2UgPSAobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSA9PiBNYXRoLnJvdW5kKG1pbiArIChtYXggLSBtaW4pICogbmV4dERvdWJsZSgpKTtcbiAgY29uc3QgbmV4dERvdWJsZVJhbmdlID0gKG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikgPT4gbWluICsgKG1heCAtIG1pbikgKiBuZXh0RG91YmxlKCk7XG5cbiAgcmV0dXJuIHtcbiAgICBzZXQgc2VlZCh2YWx1ZTogbnVtYmVyKSB7XG4gICAgICBzZWVkID0gdmFsdWU7XG4gICAgfSxcbiAgICBnZXQgc2VlZCgpIHtcbiAgICAgIHJldHVybiBzZWVkO1xuICAgIH0sXG4gICAgbmV4dEludCxcbiAgICBuZXh0RG91YmxlLFxuICAgIG5leHRCb29sZWFuLFxuICAgIG5leHRJbnRSYW5nZSxcbiAgICBuZXh0RG91YmxlUmFuZ2VcbiAgfTtcbn07XG5cbmNvbnN0IHJhbmRvbSA9IGNyZWF0ZVBSTkcoKTtcblxuZXhwb3J0IHsgcmFuZG9tIH07XG4iLCJpbXBvcnQgeyBjcmVhdGVEaXNwbGF5T2JqZWN0LCBEaXNwbGF5T2JqZWN0LCBEaXNwbGF5T2JqZWN0UHJvcHMgfSBmcm9tIFwiLi9kaXNwbGF5XCI7XG5cbmludGVyZmFjZSBTaGFwZSBleHRlbmRzIERpc3BsYXlPYmplY3Qge1xuICBjb2xvcjogc3RyaW5nO1xufVxuXG50eXBlIFNoYXBlUHJvcHMgPSBQYXJ0aWFsPHtcbiAgY29sb3I6IHN0cmluZztcbn0+ICZcbiAgRGlzcGxheU9iamVjdFByb3BzO1xuXG5jb25zdCBjcmVhdGVSZWN0U2hhcGUgPSAod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHByb3BzPzogU2hhcGVQcm9wcyk6IFNoYXBlID0+IHtcbiAgY29uc3Qgc2hhcGU6IFNoYXBlID0gT2JqZWN0LmFzc2lnbihcbiAgICBjcmVhdGVEaXNwbGF5T2JqZWN0KHdpZHRoLCBoZWlnaHQsIChjdHgpID0+IHtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSBzaGFwZS5jb2xvcjtcbiAgICAgIGN0eC5maWxsUmVjdCgwLCAwLCBzaGFwZS53aWR0aCwgc2hhcGUuaGVpZ2h0KTtcbiAgICB9KSxcbiAgICB7XG4gICAgICBjb2xvcjogXCIwXCJcbiAgICB9LFxuICAgIHByb3BzXG4gICk7XG4gIGlmIChwcm9wcykgc2hhcGUuaW5pdCgpO1xuICByZXR1cm4gc2hhcGU7XG59O1xuXG5leHBvcnQgeyBTaGFwZSwgU2hhcGVQcm9wcywgY3JlYXRlUmVjdFNoYXBlIH07XG4iLCJjb25zdCBpbml0Rm9udCA9IChjaGFycykgPT4gKGN0eCwgc3RyaW5nLCB4LCB5LCBzaXplLCBjb2xvcikgPT5cbiAgWy4uLnN0cmluZ10ucmVkdWNlKChjaGFyWCwgY2hhcikgPT4ge1xuICAgIGNvbnN0IGhlaWdodCA9IDUsXG4gICAgICBwaXhlbFNpemUgPSBzaXplIC8gaGVpZ2h0LFxuICAgICAgZm9udENvZGUgPSBjaGFyc1tjaGFyLmNoYXJDb2RlQXQoKV0gfHwgXCJcIixcbiAgICAgIGJpbmFyeUNoYXIgPSBmb250Q29kZSA+IDAgPyBmb250Q29kZSA6IGZvbnRDb2RlLmNvZGVQb2ludEF0KCksXG4gICAgICBiaW5hcnkgPSAoYmluYXJ5Q2hhciB8fCAwKS50b1N0cmluZygyKSxcbiAgICAgIHdpZHRoID0gTWF0aC5jZWlsKGJpbmFyeS5sZW5ndGggLyBoZWlnaHQpLFxuICAgICAgbWFyZ2luWCA9IGNoYXJYICsgcGl4ZWxTaXplLFxuICAgICAgZm9ybWF0dGVkQmluYXJ5ID0gYmluYXJ5LnBhZFN0YXJ0KHdpZHRoICogaGVpZ2h0LCAwKSxcbiAgICAgIGJpbmFyeUNvbHMgPSBmb3JtYXR0ZWRCaW5hcnkubWF0Y2gobmV3IFJlZ0V4cChgLnske2hlaWdodH19YCwgXCJnXCIpKTtcbiAgICBiaW5hcnlDb2xzLm1hcCgoY29sdW1uLCBjb2xQb3MpID0+XG4gICAgICBbLi4uY29sdW1uXS5tYXAoKHBpeGVsLCBwaXhQb3MpID0+IHtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9ICErcGl4ZWwgPyBcInRyYW5zcGFyZW50XCIgOiBjb2xvcjsgLy8gcGl4ZWwgPT0gMCA/XG4gICAgICAgIGN0eC5maWxsUmVjdCh4ICsgbWFyZ2luWCArIGNvbFBvcyAqIHBpeGVsU2l6ZSwgeSArIHBpeFBvcyAqIHBpeGVsU2l6ZSwgcGl4ZWxTaXplLCBwaXhlbFNpemUpO1xuICAgICAgfSlcbiAgICApO1xuICAgIHJldHVybiBjaGFyWCArICh3aWR0aCArIDEpICogcGl4ZWxTaXplO1xuICB9LCAwKTtcbmV4cG9ydCB7IGluaXRGb250IH07XG4iLCIvLyBCYXNlZCBvbiBgUGl4ZWwgRm9udGA6IGh0dHBzOi8vZ2l0aHViLmNvbS9QYXVsQkdEL1BpeGVsRm9udFxuXG5jb25zdCBmb250ID0gW1xuICAuLi5BcnJheSgzMyksXG5cbiAgMjksIC8vICEgMTExMDEgLy8gXCIgLy8gIyAvLyAkIC8vICUgLy8gJlxuICAsXG4gICxcbiAgLFxuICAsXG4gICxcbiAgMTIsIC8vICcgMDExMDAgLy8gKCAvLyApIC8vICpcbiAgLFxuICAsXG4gICxcbiAgXCLhh4RcIiwgLy8gNDU0OCAgICArIDAwMTAwIDAxMTEwIDAwMTAwXG4gIDMsIC8vIDMgICAgICAgLCAwMDAxMVxuICBcIuGChFwiLCAvLyA0MjI4ICAgIC0gMDAxMDAgMDAxMDAgMDAxMDBcbiAgMSwgLy8gMSAgICAgICAuIDAwMDAxXG4gIDExMTg0ODAsIC8vIDExMTg0ODAgLyAwMDAwMSAwMDAxMCAwMDEwMCAwMTAwMCAxMDAwMFxuICBcIue4v1wiLCAvLyAzMjMxOSAgIDAgMTExMTEgMTAwMDEgMTExMTFcbiAgMzEsIC8vIDMxICAgICAgMSAxMTExMVxuICBcIuW6vVwiLCAvLyAyNDI1MyAgIDIgMTAxMTEgMTAxMDEgMTExMDFcbiAgXCLlmr9cIiwgLy8gMjIyMDcgICAzIDEwMTAxIDEwMTAxIDExMTExXG4gIFwi54KfXCIsIC8vIDI4ODMxICAgNCAxMTEwMCAwMDEwMCAxMTExMVxuICBcIueat1wiLCAvLyAzMDM5MSAgIDUgMTExMDEgMTAxMDEgMTAxMTFcbiAgXCLnurdcIiwgLy8gMzI0MzkgICA2IDExMTExIDEwMTAxIDEwMTExXG4gIFwi5IifXCIsIC8vIDE2OTI3ICAgNyAxMDAwMCAxMDAwMCAxMTExMVxuICBcIue6v1wiLCAvLyAzMjQ0NyAgIDggMTExMTEgMTAxMDEgMTExMTFcbiAgXCLnmr9cIiwgLy8gMzAzOTkgICA5IDExMTAxIDEwMTAxIDExMTExXG4gIDE3LCAvLyAxNyAgICAgIDogMTAwMDEgLy8gOyAvLyA8XG4gICxcbiAgLFxuICBcIuKlilwiLCAvLyA9IDAxMDEwIDAxMDEwIDAxMDEwIC8vID5cbiAgLFxuICBcIuSKvFwiLCAvLyA/IDEwMDAwIDEwMTAxIDExMTAwIC8vIEBcbiAgLFxuICBcIuO5j1wiLCAvLyAxNTk1MSAgQSAwMTExMSAxMDAxMCAwMTExMVxuICBcIue6rlwiLCAvLyAzMjQzMCAgQiAxMTExMSAxMDEwMSAwMTExMFxuICBcIue4sVwiLCAvLyAzMjMwNSAgIEMgMTExMTEgMTAwMDEgMTAwMDFcbiAgXCLnuK5cIiwgLy8gMzIzMDIgICBEIDExMTExIDEwMDAxIDAxMTEwXG4gIFwi57q1XCIsIC8vIDMyNDM3ICAgRSAxMTExMSAxMDEwMSAxMDEwMVxuICBcIue6kFwiLCAvLyAzMjQwMCAgIEYgMTExMTEgMTAxMDAgMTAwMDBcbiAgXCLxtJqmXCIsIC8vIDQ3NjgzOCAgRyAwMTExMCAxMDAwMSAxMDEwMSAwMDExMFxuICBcIueyn1wiLCAvLyAzMTkwMyAgIEggMTExMTEgMDAxMDAgMTExMTFcbiAgXCLkn7FcIiwgLy8gMTg0MTcgICBJIDEwMDAxIDExMTExIDEwMDAxXG4gIFwi5Li/XCIsIC8vIDIwMDMxICAgSiAxMDAxMSAxMDAwMSAxMTExMVxuICAxMDIwMjQxLCAvLyAxMDIwMjQxIEsgMTExMTEgMDAxMDAgMDEwMTAgMTAwMDFcbiAgXCLnsKFcIiwgLy8gMzE3NzcgICBMIDExMTExIDAwMDAxIDAwMDAxXG4gIDMzMDU5MzU5LCAvLyAzMzA1OTM1OSBNIDExMTExIDEwMDAwIDExMTAwIDEwMDAwIDExMTExXG4gIDEwMjQxNTksIC8vIDEwMjQxNTkgTiAxMTExMSAwMTAwMCAwMDEwMCAxMTExMVxuICBcIue4v1wiLCAvLyAzMjMxOSAgIE8gMTExMTEgMTAwMDEgMTExMTFcbiAgXCLnupxcIiwgLy8gMzI0MTIgICBQIDExMTExIDEwMTAwIDExMTAwXG4gIFwi8byZr1wiLCAvLyA1MDk1NTEgIFEgMDExMTEgMTAwMDEgMTAwMTEgMDExMTFcbiAgXCLnuY1cIiwgLy8gMzIzMzMgICBSIDExMTExIDEwMDEwIDAxMTAxXG4gIFwi55q3XCIsIC8vIDMwMzkxICAgUyAxMTEwMSAxMDEwMSAxMDExMVxuICBcIuSPsFwiLCAvLyAxNzM5MiAgIFQgMTAwMDAgMTExMTEgMTAwMDBcbiAgXCLnsL9cIiwgLy8gMzE4MDcgICBVIDExMTExIDAwMDAxIDExMTExXG4gIDI1MzYzNjcyLCAvLyAyNTM2MzY3MiBWIDExMDAwIDAwMTEwIDAwMDAxIDAwMTEwIDExMDAwXG4gIDMyNTQxNzU5LCAvLyAzMjU0MTc1OSBXIDExMTExIDAwMDAxIDAwMDExIDAwMDAxIDExMTExXG4gIDE4MTU3OTA1LCAvLyAxODE1NzkwNSBYIDEwMDAxIDAxMDEwIDAwMTAwIDAxMDEwIDEwMDAxXG4gIFwi5oO4XCIsIC8vIDI0ODI0ICAgWSAxMTAwMCAwMDExMSAxMTAwMFxuICAxODQ3MDcwNSwgLy8gMTg0NzA3MDUgWiAxMDAwMSAxMDAxMSAxMDEwMSAxMTAwMSAxMDAwMSAvLyBbIC8vIFxcIC8vIF0gLy8gXlxuICAsXG4gICxcbiAgLFxuICAsXG4gIFwi0KFcIiAvLyAxMDU3IF8gMDAwMDEgMDAwMDEgMDAwMDFcbiAgLy8sIC8vIGBcbiAgLy8vLyAjOTc6XG4gIC8vLCAvLyBhXG4gIC8vLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLFxuICAvLy8vICMxMjM6XG4gIC8vLCAvLyB7XG4gIC8vLCAvLyB8XG4gIC8vLCAvLyB9XG4gIC8vLCAvLyB+XG5dO1xuXG5leHBvcnQgeyBmb250IH07XG4iLCJpbXBvcnQgeyBjcmVhdGVEaXNwbGF5T2JqZWN0LCBEaXNwbGF5T2JqZWN0LCBEaXNwbGF5T2JqZWN0UHJvcHMgfSBmcm9tIFwiLi9kaXNwbGF5XCI7XG5pbXBvcnQgeyBpbml0Rm9udCB9IGZyb20gXCIuL2ZvbnRcIjtcbmltcG9ydCB7IGZvbnQgfSBmcm9tIFwiLi9mb250L3BpeGVsXCI7XG5cbnR5cGUgV3JpdGVMaW5lRnVuYyA9IChcbiAgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsXG4gIHN0cmluZzogc3RyaW5nLFxuICB4OiBudW1iZXIsXG4gIHk6IG51bWJlcixcbiAgc2l6ZTogbnVtYmVyLFxuICBjb2xvcjogc3RyaW5nXG4pID0+IG51bWJlcjtcblxuaW50ZXJmYWNlIFRleHQgZXh0ZW5kcyBEaXNwbGF5T2JqZWN0IHtcbiAgdmFsdWU6IHN0cmluZztcbiAgc2l6ZTogbnVtYmVyO1xuICBjb2xvcjogc3RyaW5nO1xufVxuXG50eXBlIFRleHRQcm9wcyA9IFBhcnRpYWw8e1xuICBjb2xvcjogc3RyaW5nO1xufT4gJlxuICBEaXNwbGF5T2JqZWN0UHJvcHM7XG5cbmNvbnN0IHdyaXRlTGluZTogV3JpdGVMaW5lRnVuYyA9IGluaXRGb250KGZvbnQpO1xuXG5jb25zdCBjcmVhdGVUZXh0ID0gKHZhbHVlOiBzdHJpbmcsIHNpemU6IG51bWJlciwgcHJvcHM/OiBUZXh0UHJvcHMpOiBUZXh0ID0+IHtcbiAgY29uc3QgdGV4dDogVGV4dCA9IE9iamVjdC5hc3NpZ24oXG4gICAgY3JlYXRlRGlzcGxheU9iamVjdChzaXplLCBzaXplLCAoY3R4KSA9PiB7XG4gICAgICB0ZXh0LndpZHRoID0gd3JpdGVMaW5lKGN0eCwgdGV4dC52YWx1ZSwgMCwgMCwgdGV4dC5zaXplLCB0ZXh0LmNvbG9yKTtcbiAgICB9KSxcbiAgICB7XG4gICAgICBjb2xvcjogXCIjRkZGXCIsXG4gICAgICB2YWx1ZSxcbiAgICAgIHNpemVcbiAgICB9LFxuICAgIHByb3BzXG4gICk7XG4gIGlmIChwcm9wcykgdGV4dC5pbml0KCk7XG4gIHJldHVybiB0ZXh0O1xufTtcblxuZXhwb3J0IHsgVGV4dCwgVGV4dFByb3BzLCB3cml0ZUxpbmUsIGNyZWF0ZVRleHQgfTtcbiIsImludGVyZmFjZSBHYW1lT2JqZWN0Q29tcG9uZW50IHtcbiAgdng6IG51bWJlcjtcbiAgdnk6IG51bWJlcjtcbiAgYWNjWDogbnVtYmVyO1xuICBhY2NZOiBudW1iZXI7XG59XG5cbnR5cGUgR2FtZU9iamVjdFByb3BzID0gUGFydGlhbDxHYW1lT2JqZWN0Q29tcG9uZW50PjtcblxuY29uc3QgZ2V0R2FtZU9iamVjdENvbXBvbmVudCA9IChwcm9wcz86IEdhbWVPYmplY3RQcm9wcyk6IEdhbWVPYmplY3RDb21wb25lbnQgPT4gKHtcbiAgdng6IDAsXG4gIHZ5OiAwLFxuICBhY2NYOiAwLFxuICBhY2NZOiAwLFxuICAuLi5wcm9wc1xufSk7XG5cbmV4cG9ydCB7IEdhbWVPYmplY3RDb21wb25lbnQsIEdhbWVPYmplY3RQcm9wcywgZ2V0R2FtZU9iamVjdENvbXBvbmVudCB9O1xuIiwiaW1wb3J0IHsgYXNzZXRzLCBUaWxlIH0gZnJvbSBcIi4vYXNzZXRzXCI7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gXCIuL2NvbG9yc1wiO1xuaW1wb3J0IHsgYWRkT3V0bGluZSwgY2FudmFzUG9vbCwgY29sb3JpemVJbWFnZSwgd3JhcENhbnZhc0Z1bmMgfSBmcm9tIFwiLi9jb3JlL2NhbnZhcy11dGlsc1wiO1xuaW1wb3J0IHsgY3JlYXRlU3ByaXRlLCBTcHJpdGUsIFNwcml0ZVByb3BzIH0gZnJvbSBcIi4vY29yZS9zcHJpdGVcIjtcblxuaW50ZXJmYWNlIE1vdmllQ2xpcCBleHRlbmRzIFNwcml0ZSB7XG4gIGltYWdlczogQXJyYXk8SFRNTENhbnZhc0VsZW1lbnQ+O1xuICBjb2xvcjogQ29sb3I7XG4gIHBsYXkoKTogdm9pZDtcbiAgc3RvcChmcmFtZT86IG51bWJlcik6IHZvaWQ7XG4gIHBsYXlTcGVlZDogbnVtYmVyO1xuICBvdXRsaW5lU2l6ZTogbnVtYmVyO1xuICBvdXRsaW5lQ29sb3I6IENvbG9yO1xufVxuXG50eXBlIE1vdmllQ2xpcFByb3BzID0gUGFydGlhbDx7IHBsYXlTcGVlZDogbnVtYmVyOyBvdXRsaW5lU2l6ZTogbnVtYmVyOyBvdXRsaW5lQ29sb3I6IENvbG9yIH0+ICYgU3ByaXRlUHJvcHM7XG5cbmNvbnN0IGNyZWF0ZU1vdmllQ2xpcCA9ICh0aWxlczogQXJyYXk8VGlsZT4sIGNvbG9yOiBDb2xvciwgaXNQbGF5aW5nID0gZmFsc2UsIHByb3BzPzogTW92aWVDbGlwUHJvcHMpOiBNb3ZpZUNsaXAgPT4ge1xuICBsZXQgdGlja3MgPSAwO1xuICBsZXQgY3VyRnJhbWUgPSAwO1xuXG4gIGNvbnN0IGZyYW1lc051bSA9IHRpbGVzLmxlbmd0aDtcbiAgY29uc3QgaW1hZ2VzID0gdGlsZXMubWFwKCh0aWxlKSA9PiBjb2xvcml6ZUltYWdlKGFzc2V0c1t0aWxlXSwgY29sb3IpKTtcblxuICBjb25zdCBzcHJpdGUgPSBjcmVhdGVTcHJpdGUoaW1hZ2VzWzBdKTtcbiAgY29uc3Qgc3VwZXJJbml0ID0gc3ByaXRlLmluaXQ7XG4gIGNvbnN0IG1vdmllOiBNb3ZpZUNsaXAgPSBPYmplY3QuYXNzaWduKFxuICAgIHNwcml0ZSxcbiAgICB7XG4gICAgICBvdXRsaW5lU2l6ZTogMCxcbiAgICAgIG91dGxpbmVDb2xvcjogQ29sb3IuQnJvd25EYXJrLFxuICAgICAgcGxheVNwZWVkOiA0LFxuICAgICAgaW1hZ2VzLFxuICAgICAgY29sb3IsXG4gICAgICBwbGF5KCkge1xuICAgICAgICBpc1BsYXlpbmcgPSB0cnVlO1xuICAgICAgfSxcbiAgICAgIHN0b3AoZnJhbWUgPSAwKSB7XG4gICAgICAgIGlzUGxheWluZyA9IGZhbHNlO1xuICAgICAgICBtb3ZpZS5zZXRJbWFnZShtb3ZpZS5pbWFnZXNbKGN1ckZyYW1lID0gZnJhbWUpXSk7XG4gICAgICB9LFxuICAgICAgaW5pdCgpIHtcbiAgICAgICAgY29uc3QgbW9zID0gbW92aWUub3V0bGluZVNpemU7XG4gICAgICAgIGlmIChtb3MgPiAwKSB7XG4gICAgICAgICAgbW92aWUuYm9yZGVyU2l6ZSArPSBtb3M7XG4gICAgICAgICAgbW92aWUuaW1hZ2VzID0gbW92aWUuaW1hZ2VzLm1hcCgoaW1hZ2UpID0+IHdyYXBDYW52YXNGdW5jKGFkZE91dGxpbmUsIGltYWdlLCBtb3MsIG1vdmllLm91dGxpbmVDb2xvcikpO1xuICAgICAgICAgIG1vdmllLnNldEltYWdlKG1vdmllLmltYWdlc1swXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3VwZXJJbml0KCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICBpZiAoIWlzUGxheWluZykgcmV0dXJuO1xuXG4gICAgICAgIHRpY2tzKys7XG4gICAgICAgIGlmICh0aWNrcyAlIG1vdmllLnBsYXlTcGVlZCA9PT0gMCkge1xuICAgICAgICAgIGN1ckZyYW1lID0gKGN1ckZyYW1lICsgMSkgJSBmcmFtZXNOdW07XG4gICAgICAgICAgbW92aWUuc2V0SW1hZ2UobW92aWUuaW1hZ2VzW2N1ckZyYW1lXSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZXN0cm95KCkge1xuICAgICAgICB3aGlsZSAobW92aWUuaW1hZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjYW52YXNQb29sLmZyZWUobW92aWUuaW1hZ2VzLnBvcCgpISk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHByb3BzXG4gICk7XG4gIGlmIChwcm9wcykgbW92aWUuaW5pdCgpO1xuXG4gIHJldHVybiBtb3ZpZTtcbn07XG5cbmV4cG9ydCB7IE1vdmllQ2xpcCwgTW92aWVDbGlwUHJvcHMsIGNyZWF0ZU1vdmllQ2xpcCB9O1xuIiwiaW1wb3J0IHsgQVNTRVRTX0JPUkRFUl9TSVpFLCBBU1NFVFNfT1VUTElORV9TSVpFLCBUaWxlIH0gZnJvbSBcIi4vYXNzZXRzXCI7XG5pbXBvcnQgeyBDb2xvcmVkU3ByaXRlLCBjcmVhdGVDb2xvcmVkU3ByaXRlIH0gZnJvbSBcIi4vY29sb3JlZC1zcHJpdGVcIjtcbmltcG9ydCB7IENvbG9yIH0gZnJvbSBcIi4vY29sb3JzXCI7XG5pbXBvcnQgeyBEaXNwbGF5T2JqZWN0IH0gZnJvbSBcIi4vY29yZS9kaXNwbGF5XCI7XG5pbXBvcnQgeyBHYW1lT2JqZWN0Q29tcG9uZW50LCBHYW1lT2JqZWN0UHJvcHMsIGdldEdhbWVPYmplY3RDb21wb25lbnQgfSBmcm9tIFwiLi9jb3JlL2dhbWUtb2JqZWN0XCI7XG5pbXBvcnQgeyBTcHJpdGUsIFNwcml0ZVByb3BzIH0gZnJvbSBcIi4vY29yZS9zcHJpdGVcIjtcbmltcG9ydCB7IGNyZWF0ZU1vdmllQ2xpcCB9IGZyb20gXCIuL21vdmllLWNsaXBcIjtcblxuaW50ZXJmYWNlIEVuZW15IGV4dGVuZHMgR2FtZU9iamVjdENvbXBvbmVudCwgU3ByaXRlIHt9XG5cbnR5cGUgRW5lbXlQcm9wcyA9IEdhbWVPYmplY3RQcm9wcyAmIFNwcml0ZVByb3BzO1xuXG5jb25zdCBjcmVhdGVFbmVteSA9ICh0aWxlOiBUaWxlLCBjb2xvcjogQ29sb3IsIHByb3BzPzogRW5lbXlQcm9wcyk6IEVuZW15ID0+IHtcbiAgY29uc3QgZW5lbXkgPSBPYmplY3QuYXNzaWduKGNyZWF0ZUNvbG9yZWRTcHJpdGUodGlsZSwgY29sb3IpLCBnZXRHYW1lT2JqZWN0Q29tcG9uZW50KCksIHByb3BzKTtcbiAgaWYgKHByb3BzKSBlbmVteS5pbml0KCk7XG4gIHJldHVybiBlbmVteTtcbn07XG5cbmV4cG9ydCB7IEVuZW15LCBFbmVteVByb3BzLCBjcmVhdGVFbmVteSB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIFNuYWtlIGV4dGVuZHMgQ29sb3JlZFNwcml0ZSB7XG4gIHRhcmdldD86IERpc3BsYXlPYmplY3Q7XG59XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVTbmFrZSA9ICgpOiBTbmFrZSA9PiB7XG4gIGxldCB0aW1lID0gMDtcbiAgY29uc3Qgc25ha2U6IFNuYWtlID0gT2JqZWN0LmFzc2lnbihcbiAgICBjcmVhdGVDb2xvcmVkU3ByaXRlKFRpbGUuU25ha2UsIENvbG9yLkdyZWVuKSxcbiAgICB7XG4gICAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICBpZiAoIXNuYWtlLnRhcmdldCkgcmV0dXJuO1xuXG4gICAgICAgIHRpbWUgKz0gZHQ7XG4gICAgICAgIHNuYWtlLnNjYWxlWCA9IE1hdGguc2lnbihzbmFrZS54IC0gc25ha2UudGFyZ2V0LngpO1xuICAgICAgICAvLyBzbmFrZS5zY2FsZVkgPSAwLjkgKyBNYXRoLnNpbih0aW1lIC8gMTAwKSAqIDAuMTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIHBpdm90WDogMC41LFxuICAgICAgcGl2b3RZOiAxLFxuICAgICAgYm9yZGVyU2l6ZTogQVNTRVRTX0JPUkRFUl9TSVpFXG4gICAgfVxuICApO1xuICBzbmFrZS5pbml0KCk7XG5cbiAgcmV0dXJuIHNuYWtlO1xufTtcblxuZXhwb3J0IGludGVyZmFjZSBHaG9zdCBleHRlbmRzIEVuZW15IHtcbiAgdGFyZ2V0PzogRGlzcGxheU9iamVjdDtcbn1cblxuZXhwb3J0IGNvbnN0IGNyZWF0ZUdob3N0ID0gKHsgeCwgeSB9OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0pOiBHaG9zdCA9PiB7XG4gIGNvbnN0IGFuaW0gPSBjcmVhdGVNb3ZpZUNsaXAoW1RpbGUuR2hvc3QsIFRpbGUuR2hvc3QxXSwgQ29sb3IuR3JleUxpZ2h0LCB0cnVlKTtcbiAgY29uc3Qgc3VwZXJVcGRhdGUgPSBhbmltLnVwZGF0ZTtcbiAgY29uc3QgZ2hvc3Q6IEdob3N0ID0gT2JqZWN0LmFzc2lnbihcbiAgICBhbmltLFxuICAgIGdldEdhbWVPYmplY3RDb21wb25lbnQoKSxcbiAgICB7XG4gICAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICAvLyBUT0RPOiBtYWtlIGFuaW1hdGlvbiBmYXN0ZXIgd2hlbiBpdCdzIGNsb3NlciB0byB0aGUgcGxheWVyXG5cbiAgICAgICAgc3VwZXJVcGRhdGUoZHQpO1xuXG4gICAgICAgIGlmICghZ2hvc3QudGFyZ2V0KSByZXR1cm47XG5cbiAgICAgICAgZ2hvc3QueCArPSAoZ2hvc3QudGFyZ2V0LnggLSBnaG9zdC54KSAqIDAuMDAxO1xuICAgICAgICBnaG9zdC55ICs9IChnaG9zdC50YXJnZXQueSAtIGdob3N0LnkpICogMC4wMDE7XG4gICAgICAgIGdob3N0LnNjYWxlWCA9IE1hdGguc2lnbihnaG9zdC54IC0gZ2hvc3QudGFyZ2V0LngpO1xuICAgICAgfVxuICAgIH0sXG4gICAgeyB4LCB5LCBwaXZvdFg6IDAuNSwgcGl2b3RZOiAwLjUsIGJvcmRlclNpemU6IEFTU0VUU19CT1JERVJfU0laRSwgcGxheVNwZWVkOiAxNiwgb3V0bGluZVNpemU6IEFTU0VUU19PVVRMSU5FX1NJWkUgfVxuICApO1xuICBnaG9zdC5pbml0KCk7XG5cbiAgcmV0dXJuIGdob3N0O1xufTtcbiIsImNvbnN0IGxvYWRJbWFnZSA9ICh1cmw6IHN0cmluZyk6IFByb21pc2U8SFRNTEltYWdlRWxlbWVudD4gPT5cbiAgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IGltYWdlID0gbmV3IEltYWdlKCk7XG4gICAgaW1hZ2Uuc3JjID0gdXJsO1xuICAgIGltYWdlLm9ubG9hZCA9ICgpID0+IHJlc29sdmUoaW1hZ2UpO1xuICAgIGltYWdlLm9uZXJyb3IgPSByZWplY3Q7XG4gIH0pO1xuXG5jb25zdCB3YWl0ID0gKGR1cmF0aW9uID0gMCkgPT5cbiAgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICBzZXRUaW1lb3V0KHJlc29sdmUsIGR1cmF0aW9uKTtcbiAgfSk7XG5cbmNvbnN0IHNodWZmbGUgPSA8VD4oYXJyYXk6IEFycmF5PFQ+KTogdm9pZCA9PiB7XG4gIGZvciAobGV0IGkgPSBhcnJheS5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgY29uc3QgaiA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChpICsgMSkpO1xuICAgIFthcnJheVtpXSwgYXJyYXlbal1dID0gW2FycmF5W2pdLCBhcnJheVtpXV07XG4gIH1cbn07XG5cbmNvbnN0IHBhZFplcm9zID0gKGNvdW50OiBudW1iZXIsIHZhbHVlOiBudW1iZXIpID0+IFN0cmluZyh2YWx1ZSkucGFkU3RhcnQoY291bnQsIFwiMFwiKTtcblxuY29uc3QgZ2V0UmFuZG9tRWxlbWVudCA9IDxUPihhcnI6IEFycmF5PFQ+KTogVCA9PiBhcnJbKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKSB8IDBdO1xuXG5jb25zdCBjbGFtcCA9ICh2YWx1ZTogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpID0+IE1hdGgubWF4KG1pbiwgTWF0aC5taW4obWF4LCB2YWx1ZSkpO1xuY29uc3QgbGVycCA9ICh4OiBudW1iZXIsIHk6IG51bWJlciwgdDogbnVtYmVyKSA9PiAoMSAtIHQpICogeCArIHQgKiB5O1xuLy8gVE9ETzogYWRkIGludkxlcnAgYW5kIG1vdmUgYWxsIHRvIE1hdGggdXRpbHNcbmNvbnN0IHJlbWFwID0gKHg6IG51bWJlciwgYTE6IG51bWJlciwgYTI6IG51bWJlciwgYjE6IG51bWJlciwgYjI6IG51bWJlcikgPT4gYjEgKyAoKHggLSBhMSkgKiAoYjIgLSBiMSkpIC8gKGEyIC0gYTEpO1xuXG5leHBvcnQgeyBsb2FkSW1hZ2UsIHdhaXQsIHNodWZmbGUsIHBhZFplcm9zLCBnZXRSYW5kb21FbGVtZW50LCBjbGFtcCwgbGVycCwgcmVtYXAgfTtcbiIsImltcG9ydCB7IGFzc2V0cywgQVNTRVRTX1NDQUxFRF9JVEVNX1NJWkUsIEFTU0VUU19TQ0FMRURfVElMRV9TSVpFLCBUaWxlIH0gZnJvbSBcIi4vYXNzZXRzXCI7XG5pbXBvcnQgeyBjcmVhdGVEaXNwbGF5T2JqZWN0LCBEaXNwbGF5T2JqZWN0IH0gZnJvbSBcIi4vY29yZS9kaXNwbGF5XCI7XG5pbXBvcnQgeyB3cml0ZUxpbmUgfSBmcm9tIFwiLi9jb3JlL3RleHRcIjtcbmltcG9ydCB7IHBhZFplcm9zIH0gZnJvbSBcIi4vdXRpbHNcIjtcblxuaW50ZXJmYWNlIEhVRCBleHRlbmRzIERpc3BsYXlPYmplY3Qge1xuICBzZXRSb29tTm8odmFsdWU6IG51bWJlciwgaGFzR3JhdmVzPzogYm9vbGVhbik6IHZvaWQ7XG4gIHNldENvaW5zQ291bnQodmFsdWU6IG51bWJlcik6IHZvaWQ7XG59XG5cbmNvbnN0IGNyZWF0ZUhVRCA9ICh3aWR0aDogbnVtYmVyKTogSFVEID0+IHtcbiAgbGV0IHJvb21ObyA9IDA7XG4gIGxldCBjb2luc0NvdW50OiBzdHJpbmc7XG4gIGxldCBzeDogbnVtYmVyO1xuXG4gIGNvbnN0IGhlaWdodCA9IEFTU0VUU19TQ0FMRURfVElMRV9TSVpFO1xuICBjb25zdCBzY2FsZWRTaXplID0gQVNTRVRTX1NDQUxFRF9JVEVNX1NJWkU7XG4gIGNvbnN0IG9mZnNldCA9IChoZWlnaHQgLSBzY2FsZWRTaXplKSAvIDI7XG4gIGNvbnN0IGNvaW5JY29uID0gYXNzZXRzW1RpbGUuQ29pbkhVRF07XG4gIGNvbnN0IGNvbG9yID0gXCIjRkZGXCI7XG5cbiAgY29uc3QgaHVkOiBIVUQgPSBPYmplY3QuYXNzaWduKFxuICAgIGNyZWF0ZURpc3BsYXlPYmplY3Qod2lkdGgsIGhlaWdodCwgKGNvbnRleHQ6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCkgPT4ge1xuICAgICAgd3JpdGVMaW5lKGNvbnRleHQsIFwiUk9PTSBcIiArIHJvb21ObywgaGVpZ2h0LCBvZmZzZXQsIHNjYWxlZFNpemUsIGNvbG9yKTtcbiAgICAgIHN4ID0gd2lkdGggLSA0ICogaGVpZ2h0O1xuICAgICAgc3ggKz0gd3JpdGVMaW5lKGNvbnRleHQsIGNvaW5zQ291bnQsIHN4LCBvZmZzZXQsIHNjYWxlZFNpemUsIGNvbG9yKTtcbiAgICAgIGNvbnRleHQuZHJhd0ltYWdlKGNvaW5JY29uLCBzeCArIG9mZnNldCAqIDIsIG9mZnNldCk7XG4gICAgfSksXG4gICAge1xuICAgICAgc2V0Um9vbU5vKHZhbHVlOiBudW1iZXIpIHtcbiAgICAgICAgcm9vbU5vID0gdmFsdWU7XG4gICAgICB9LFxuICAgICAgc2V0Q29pbnNDb3VudCh2YWx1ZTogbnVtYmVyKSB7XG4gICAgICAgIGNvaW5zQ291bnQgPSBwYWRaZXJvcygzLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICApO1xuICBodWQuc2V0Q29pbnNDb3VudCgwKTtcbiAgcmV0dXJuIGh1ZDtcbn07XG5cbmV4cG9ydCB7IGNyZWF0ZUhVRCB9O1xuIiwiLy8gcHJldHRpZXItaWdub3JlXG5leHBvcnQgZGVmYXVsdCBbXG4gIFssLDE4OTAsMC4wMSwwLjAyLDAuMTksLDAuNDUsLCwsLDAuMDIsLCwsLDAuOSwwLjAxXSwgLy8gQ29pblxuICBbMS4wMSwsNDg0LCwwLjAzLDAuMDYsMSwxLjc5LDE4LC0yLjUsLCwsMC4zLCwsLDAuOTgsMC4wMV0sIC8vIEp1bXBcbiAgWzEuMTIsLDQwNywuMDMsLjAxLC4xOSw0LDIuMywsLTEuOSwsLCwxLjIsLC4zLCwuNDYsLjAzXSwgLy8gSGl0XG4gIFtdLCAvLyBPcHRpb25cbl07XG5cbi8vIFNlbGVjdFxuLy8gRG9vclxuLy8gV2luXG4iLCJpbXBvcnQgc2Z4IGZyb20gXCIuL2Fzc2V0cy9zZnhcIjtcbmltcG9ydCB7IHp6ZngsIHp6ZnhNLCB6emZ4UCwgenpmeFggfSBmcm9tIFwiLi9jb3JlL3NvdW5kL3p6ZnhcIjtcbmltcG9ydCB7IHdhaXQgfSBmcm9tIFwiLi91dGlsc1wiO1xuXG5jb25zdCBlbnVtIFNvdW5kIHtcbiAgQ29pbixcbiAgSnVtcCxcbiAgSGl0LFxuICBPcHRpb25cbn1cblxuY29uc3QgcGxheVNvdW5kID0gKHNvdW5kOiBTb3VuZCkgPT4genpmeCguLi5zZnhbc291bmRdKTtcblxuY29uc3QgcGxheU11c2ljID0gYXN5bmMgKHNvdXJjZTogYW55KSA9PiB7XG4gIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHJlbmRlclNvbmcoc291cmNlKSxcbiAgICBub2RlID0genpmeFAoLi4uYnVmZmVyKTtcbiAgbm9kZS5sb29wID0gdHJ1ZTtcbiAgenpmeFgucmVzdW1lKCk7XG59O1xuXG5jb25zdCByZW5kZXJTb25nID0gYXN5bmMgKHNvbmc6IGFueSk6IFByb21pc2U8YW55W11bXT4gPT4ge1xuICBhd2FpdCB3YWl0KDUwKTtcbiAgcmV0dXJuIHp6ZnhNKC4uLnNvbmcpO1xufTtcblxuZXhwb3J0IHsgU291bmQsIHBsYXlTb3VuZCwgcGxheU11c2ljIH07XG4iLCJpbXBvcnQgeyBhc3NldHMsIEFTU0VUU19PVVRMSU5FX1NJWkUsIFRpbGUgfSBmcm9tIFwiLi9hc3NldHNcIjtcbmltcG9ydCB7IENvbG9yIH0gZnJvbSBcIi4vY29sb3JzXCI7XG5pbXBvcnQgeyBhZGRPdXRsaW5lLCBjYW52YXNQb29sLCBjb2xvcml6ZUltYWdlLCB3cmFwQ2FudmFzRnVuYyB9IGZyb20gXCIuL2NvcmUvY2FudmFzLXV0aWxzXCI7XG5pbXBvcnQgeyBHYW1lT2JqZWN0Q29tcG9uZW50LCBHYW1lT2JqZWN0UHJvcHMsIGdldEdhbWVPYmplY3RDb21wb25lbnQgfSBmcm9tIFwiLi9jb3JlL2dhbWUtb2JqZWN0XCI7XG5pbXBvcnQgeyBjcmVhdGVNb3ZpZUNsaXAsIE1vdmllQ2xpcCwgTW92aWVDbGlwUHJvcHMgfSBmcm9tIFwiLi9tb3ZpZS1jbGlwXCI7XG5pbXBvcnQgeyBwbGF5U291bmQsIFNvdW5kIH0gZnJvbSBcIi4vc291bmRzXCI7XG5pbXBvcnQgeyByZW1hcCB9IGZyb20gXCIuL3V0aWxzXCI7XG5cbmludGVyZmFjZSBQbGF5ZXIgZXh0ZW5kcyBHYW1lT2JqZWN0Q29tcG9uZW50LCBNb3ZpZUNsaXAge1xuICByZWFkb25seSB0aWxlOiBUaWxlO1xuICByZWFkb25seSBncmF2ZVRpbGU6IFRpbGU7XG4gIGZyaWN0aW9uWDogbnVtYmVyO1xuICBmcmljdGlvblk6IG51bWJlcjtcbiAgZ3Jhdml0eTogbnVtYmVyO1xuICBqdW1wRm9yY2U6IG51bWJlcjtcbiAgaXNPbkdyb3VuZDogYm9vbGVhbjtcbiAgZGllKCk6IHZvaWQ7XG4gIGlzQWxpdmUoKTogYm9vbGVhbjtcbn1cblxudHlwZSBQbGF5ZXJQcm9wcyA9IHtcbiAgZnJpY3Rpb25YOiBudW1iZXI7XG4gIGZyaWN0aW9uWTogbnVtYmVyO1xuICBncmF2aXR5OiBudW1iZXI7XG4gIGp1bXBGb3JjZTogbnVtYmVyO1xuICBpc09uR3JvdW5kOiBib29sZWFuO1xufSAmIEdhbWVPYmplY3RQcm9wcyAmXG4gIE1vdmllQ2xpcFByb3BzO1xuXG5jb25zdCBjcmVhdGVQbGF5ZXIgPSAodGlsZXM6IEFycmF5PFRpbGU+LCBncmF2ZVRpbGU6IFRpbGUsIGNvbG9yOiBDb2xvciwgcHJvcHM6IFBsYXllclByb3BzKTogUGxheWVyID0+IHtcbiAgbGV0IGdyYXZlOiBIVE1MQ2FudmFzRWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgbGV0IGlzRGVhZCA9IGZhbHNlO1xuXG4gIGNvbnN0IHN1cGVyUGxheWVyID0gY3JlYXRlTW92aWVDbGlwKHRpbGVzLCBjb2xvciwgdHJ1ZSk7XG4gIGNvbnN0IHsgdXBkYXRlOiBzdXBlclVwZGF0ZSwgc3RvcDogc3VwZXJTdG9wLCBkZXN0cm95OiBzdXBlckRlc3Ryb3kgfSA9IHN1cGVyUGxheWVyO1xuXG4gIGNvbnN0IHBsYXllcjogUGxheWVyID0gT2JqZWN0LmFzc2lnbihcbiAgICBzdXBlclBsYXllcixcbiAgICBnZXRHYW1lT2JqZWN0Q29tcG9uZW50KCksXG4gICAge1xuICAgICAgdGlsZTogdGlsZXNbMF0sXG4gICAgICBncmF2ZVRpbGUsXG4gICAgICBpc0FsaXZlKCkge1xuICAgICAgICByZXR1cm4gIWlzRGVhZDtcbiAgICAgIH0sXG4gICAgICBkaWUoKSB7XG4gICAgICAgIHBsYXlTb3VuZChTb3VuZC5IaXQpO1xuXG4gICAgICAgIGlzRGVhZCA9IHRydWU7XG5cbiAgICAgICAgZ3JhdmUgPSBjb2xvcml6ZUltYWdlKGFzc2V0c1tncmF2ZVRpbGVdLCBjb2xvcik7XG4gICAgICAgIGdyYXZlID0gd3JhcENhbnZhc0Z1bmMoYWRkT3V0bGluZSwgZ3JhdmUsIEFTU0VUU19PVVRMSU5FX1NJWkUsIENvbG9yLkJyb3duRGFyayk7XG5cbiAgICAgICAgcGxheWVyLnNldEltYWdlKGdyYXZlKTtcblxuICAgICAgICBwbGF5ZXIuYWNjWCA9IHBsYXllci5hY2NZID0gcGxheWVyLnNrZXdYID0gMDtcbiAgICAgIH0sXG4gICAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICBpZiAoIWlzRGVhZCkge1xuICAgICAgICAgIGlmIChwbGF5ZXIuaXNPbkdyb3VuZCAmJiBNYXRoLmFicyhwbGF5ZXIudngpID4gMC4yKSB7XG4gICAgICAgICAgICBwbGF5ZXIucGxheSgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwbGF5ZXIuc3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwbGF5ZXIuc2tld1ggPSAtcmVtYXAoTWF0aC5hYnMocGxheWVyLnZ4KSwgMCwgNSwgMCwgMC4xNCk7XG4gICAgICAgICAgc3VwZXJVcGRhdGUoZHQpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgc3RvcChmcmFtZT86IG51bWJlcikge1xuICAgICAgICBpZiAoIWlzRGVhZCkgc3VwZXJTdG9wKGZyYW1lKTtcbiAgICAgIH0sXG4gICAgICBkZXN0cm95KCkge1xuICAgICAgICBpZiAoZ3JhdmUpIGNhbnZhc1Bvb2wuZnJlZShncmF2ZSk7XG4gICAgICAgIHN1cGVyRGVzdHJveSgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgcHJvcHNcbiAgKTtcbiAgcGxheWVyLmluaXQoKTtcblxuICByZXR1cm4gcGxheWVyO1xufTtcblxuZXhwb3J0IHsgUGxheWVyLCBQbGF5ZXJQcm9wcywgY3JlYXRlUGxheWVyIH07XG4iLCJpbXBvcnQgeyByYW5kb20gfSBmcm9tIFwiLi9jb3JlL3JhbmRvbVwiO1xuXG50eXBlIENlbGwgPSB7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xuICB0ZXJyYWluOiBUZXJyYWluVHlwZTtcbiAgaXRlbT86IEl0ZW1UeXBlO1xufTtcblxudHlwZSBMZXZlbCA9IHtcbiAgd2lkdGhJblRpbGVzOiBudW1iZXI7XG4gIGhlaWdodEluVGlsZXM6IG51bWJlcjtcbiAgcm9vbU5vOiBudW1iZXI7XG4gIG51bUNoZXN0cz86IG51bWJlcjtcbn07XG5cbnR5cGUgUm9vbSA9IHtcbiAgbWFwOiBDZWxsW107XG4gIGl0ZW1Mb2NhdGlvbnM6IENlbGxbXTtcbn07XG5cbmNvbnN0IGVudW0gVGVycmFpblR5cGUge1xuICBSb2NrLFxuICBTa3ksXG4gIEJvcmRlcixcbiAgR3Jhc3Ncbn1cblxuY29uc3QgZW51bSBJdGVtVHlwZSB7XG4gIFBsYXllcixcbiAgVHJlYXN1cmUsXG4gIEV4aXQsXG4gIFBvcnRhbCxcbiAgU25ha2UsXG4gIEJhdFxufVxuXG5jb25zdCByYW5kb21JbnQgPSAobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSA9PiBNYXRoLmZsb29yKHJhbmRvbS5uZXh0RG91YmxlKCkgKiAobWF4IC0gbWluICsgMSkpICsgbWluO1xuY29uc3QgcXVhcnRlctChaGFuY2UgPSAoKSA9PiByYW5kb21JbnQoMCwgMykgPT09IDA7XG5jb25zdCBjZWxsSXNFbXB0eSA9IChjZWxsOiBDZWxsIHwgdW5kZWZpbmVkKSA9PiBjZWxsPy50ZXJyYWluID09PSBUZXJyYWluVHlwZS5Ta3k7XG5cbi8vIHJvb20gbGF5b3V0IGdlbmVyYXRvclxuY29uc3QgZ2VuZXJhdGVSb29tID0gKHsgd2lkdGhJblRpbGVzLCBoZWlnaHRJblRpbGVzLCByb29tTm8sIG51bUNoZXN0cyA9IDUgfTogTGV2ZWwpOiBSb29tID0+IHtcbiAgY29uc3QgTUFYX0hPTEVTID0gMztcbiAgY29uc3QgbWFwOiBBcnJheTxDZWxsPiA9IFtdO1xuICBjb25zdCBpdGVtTG9jYXRpb25zOiBBcnJheTxDZWxsPiA9IFtdO1xuICBjb25zdCBncm91bmRTcGF3bkxvY2F0aW9uczogQXJyYXk8Q2VsbD4gPSBbXTtcbiAgY29uc3QgYWlyU3Bhd25Mb2NhdGlvbnM6IEFycmF5PENlbGw+ID0gW107XG4gIGNvbnN0IG51bUNlbGxzID0gaGVpZ2h0SW5UaWxlcyAqIHdpZHRoSW5UaWxlcztcbiAgY29uc3QgZ2V0SW5kZXggPSAoeDogbnVtYmVyLCB5OiBudW1iZXIpID0+IHggKyB5ICogd2lkdGhJblRpbGVzO1xuICBjb25zdCBnZXRDZWxsQXQgPSAocHg6IG51bWJlciwgcHk6IG51bWJlcikgPT4gbWFwW2dldEluZGV4KHB4LCBweSldO1xuICBjb25zdCBnZXRDZWxsTmVhciA9IChjOiBDZWxsLCBkeDogbnVtYmVyLCBkeTogbnVtYmVyKTogQ2VsbCB8IHVuZGVmaW5lZCA9PiBtYXBbZ2V0SW5kZXgoYy54ICsgZHgsIGMueSArIGR5KV07XG4gIGNvbnN0IHBsYWNlSXRlbSA9ICh0eXBlOiBJdGVtVHlwZSwgbG9jYXRpb25zOiBBcnJheTxDZWxsPik6IENlbGwgPT4ge1xuICAgIGNvbnN0IHJhbmRJbmRleCA9IHJhbmRvbUludCgwLCBsb2NhdGlvbnMubGVuZ3RoIC0gMSksXG4gICAgICBsb2MgPSBsb2NhdGlvbnNbcmFuZEluZGV4XSxcbiAgICAgIGxlZnROZWlnaGJvciA9IGdldENlbGxOZWFyKGxvYywgLTEsIDApISxcbiAgICAgIHJpZ2h0TmVpZ2hib3IgPSBnZXRDZWxsTmVhcihsb2MsIDEsIDApITtcbiAgICBsb2NhdGlvbnMuc3BsaWNlKHJhbmRJbmRleCwgMSk7XG4gICAgaWYgKGxlZnROZWlnaGJvci5pdGVtIHx8IHJpZ2h0TmVpZ2hib3IuaXRlbSkge1xuICAgICAgcmV0dXJuIHBsYWNlSXRlbSh0eXBlLCBsb2NhdGlvbnMpO1xuICAgIH1cbiAgICBsb2MuaXRlbSA9IHR5cGU7XG4gICAgcmV0dXJuIGxvYztcbiAgfTtcbiAgY29uc3QgaGFzRW5lbXkgPSAoY2VsbDogQ2VsbCB8IHVuZGVmaW5lZCkgPT5cbiAgICBjZWxsPy5pdGVtICYmIChjZWxsLml0ZW0gPT09IEl0ZW1UeXBlLlNuYWtlIHx8IGNlbGwuaXRlbSA9PT0gSXRlbVR5cGUuQmF0KTtcbiAgY29uc3QgcGxhY2VFbmVteSA9ICh0eXBlOiBJdGVtVHlwZSwgbG9jYXRpb25zOiBBcnJheTxDZWxsPik6IENlbGwgfCB1bmRlZmluZWQgPT4ge1xuICAgIGlmIChsb2NhdGlvbnMubGVuZ3RoID09PSAwKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIGNvbnN0IHJhbmRJbmRleCA9IHJhbmRvbUludCgwLCBsb2NhdGlvbnMubGVuZ3RoIC0gMSksXG4gICAgICBsb2MgPSBsb2NhdGlvbnNbcmFuZEluZGV4XTtcbiAgICBsb2NhdGlvbnMuc3BsaWNlKHJhbmRJbmRleCwgMSk7XG4gICAgaWYgKFxuICAgICAgaGFzRW5lbXkoZ2V0Q2VsbE5lYXIobG9jLCAtMSwgMCkpIHx8XG4gICAgICBoYXNFbmVteShnZXRDZWxsTmVhcihsb2MsIDEsIDApKSB8fFxuICAgICAgaGFzRW5lbXkoZ2V0Q2VsbE5lYXIobG9jLCAwLCAtMSkpIHx8XG4gICAgICBoYXNFbmVteShnZXRDZWxsTmVhcihsb2MsIDAsIDEpKVxuICAgICkge1xuICAgICAgcmV0dXJuIHBsYWNlRW5lbXkodHlwZSwgbG9jYXRpb25zKTtcbiAgICB9XG4gICAgbG9jLml0ZW0gPSB0eXBlO1xuICAgIHJldHVybiBsb2M7XG4gIH07XG4gIGNvbnN0IGxldmVsVGhyZXNob2xkID0gODtcbiAgY29uc3QgbWF4R3JvdW5kRW5lbWllcyA9IE1hdGguZmxvb3Iocm9vbU5vIC8gbGV2ZWxUaHJlc2hvbGQpICsgMTtcbiAgY29uc3QgbWF4Rmx5aW5nRW5lbWllcyA9IE1hdGguZmxvb3Iocm9vbU5vIC8gbGV2ZWxUaHJlc2hvbGQpO1xuICBjb25zdCBncm91bmRFbmVtaWVzTGltaXQgPSBNYXRoLnJvdW5kKHJhbmRvbS5uZXh0RG91YmxlKCkgKiBtYXhHcm91bmRFbmVtaWVzKTtcbiAgY29uc3QgZmx5aW5nRW5lbWllc0xpbWl0ID0gTWF0aC5yb3VuZChyYW5kb20ubmV4dERvdWJsZSgpICogbWF4Rmx5aW5nRW5lbWllcyk7XG4gIGNvbnN0IGJ1c3lDZWxsczogQXJyYXk8Q2VsbD4gPSBbXTtcblxuICBsZXQgaTogbnVtYmVyO1xuICBsZXQgY2VsbDogQ2VsbDtcbiAgbGV0IGhvbGVzTnVtID0gMDtcbiAgbGV0IG51bUVuZW1pZXMgPSAwO1xuICBsZXQgZmxvb3I6IEFycmF5PENlbGw+ID0gW107XG5cbiAgaWYgKHJvb21ObyA9PT0gMCkge1xuICAgIGZvciAoaSA9IDA7IGkgPCBudW1DZWxsczsgaSsrKSB7XG4gICAgICBjb25zdCB4ID0gaSAlIHdpZHRoSW5UaWxlcztcbiAgICAgIGNvbnN0IHkgPSAoaSAvIHdpZHRoSW5UaWxlcykgfCAwO1xuICAgICAgbWFwLnB1c2goe1xuICAgICAgICB4LFxuICAgICAgICB5LFxuICAgICAgICB0ZXJyYWluOiB5ID09PSBoZWlnaHRJblRpbGVzIC0gMSAmJiB4ICE9PSA5ID8gVGVycmFpblR5cGUuQm9yZGVyIDogVGVycmFpblR5cGUuU2t5XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBbXG4gICAgICBbMiwgaGVpZ2h0SW5UaWxlcyAtIDIsIEl0ZW1UeXBlLlBsYXllcl0sXG4gICAgICBbNCwgaGVpZ2h0SW5UaWxlcyAtIDIsIEl0ZW1UeXBlLlRyZWFzdXJlXSxcbiAgICAgIFs1LCBoZWlnaHRJblRpbGVzIC0gMiwgSXRlbVR5cGUuVHJlYXN1cmVdLFxuICAgICAgWzYsIGhlaWdodEluVGlsZXMgLSAyLCBJdGVtVHlwZS5UcmVhc3VyZV0sXG4gICAgICBbOCwgaGVpZ2h0SW5UaWxlcyAtIDIsIEl0ZW1UeXBlLlRyZWFzdXJlXSxcbiAgICAgIFt3aWR0aEluVGlsZXMgLSA1LCBoZWlnaHRJblRpbGVzIC0gMywgSXRlbVR5cGUuRXhpdF1cbiAgICBdLmZvckVhY2goKFt4LCB5LCBpdGVtVHlwZV0pID0+IChnZXRDZWxsQXQoeCwgeSkuaXRlbSA9IGl0ZW1UeXBlKSk7XG4gICAgW1xuICAgICAgW3dpZHRoSW5UaWxlcyAtIDQsIGhlaWdodEluVGlsZXMgLSAyLCBUZXJyYWluVHlwZS5HcmFzc10sXG4gICAgICBbd2lkdGhJblRpbGVzIC0gNSwgaGVpZ2h0SW5UaWxlcyAtIDIsIFRlcnJhaW5UeXBlLkdyYXNzXSxcbiAgICAgIFt3aWR0aEluVGlsZXMgLSA2LCBoZWlnaHRJblRpbGVzIC0gMiwgVGVycmFpblR5cGUuR3Jhc3NdLFxuICAgICAgWzksIGhlaWdodEluVGlsZXMgLSA1LCBUZXJyYWluVHlwZS5Sb2NrXSxcbiAgICAgIFsxMCwgaGVpZ2h0SW5UaWxlcyAtIDUsIFRlcnJhaW5UeXBlLlJvY2tdXG4gICAgXS5mb3JFYWNoKChbeCwgeSwgdGVycmFpblR5cGVdKSA9PiAoZ2V0Q2VsbEF0KHgsIHkpLnRlcnJhaW4gPSB0ZXJyYWluVHlwZSkpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1hcCxcbiAgICAgIGl0ZW1Mb2NhdGlvbnNcbiAgICB9O1xuICB9XG5cbiAgLy8gbWFrZU1hcFxuICBmb3IgKGkgPSAwOyBpIDwgbnVtQ2VsbHM7IGkrKykge1xuICAgIG1hcC5wdXNoKHtcbiAgICAgIHg6IGkgJSB3aWR0aEluVGlsZXMsXG4gICAgICB5OiAoaSAvIHdpZHRoSW5UaWxlcykgfCAwLFxuICAgICAgdGVycmFpbjogcXVhcnRlctChaGFuY2UoKSA/IFRlcnJhaW5UeXBlLlJvY2sgOiBUZXJyYWluVHlwZS5Ta3lcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHRlcnJhZm9ybU1hcFxuICBtYXAuZm9yRWFjaCgoYykgPT4ge1xuICAgIGNvbnN0IGNlbGxUd29BYm92ZSA9IGdldENlbGxOZWFyKGMsIDAsIC0yKTtcblxuICAgIGlmIChjLnggPT09IDAgfHwgYy55ID09PSAwIHx8IGMueCA9PT0gd2lkdGhJblRpbGVzIC0gMSB8fCBjLnkgPT09IGhlaWdodEluVGlsZXMgLSAxKSB7XG4gICAgICBpZiAoYy55ID09PSBoZWlnaHRJblRpbGVzIC0gMSkge1xuICAgICAgICBjLnRlcnJhaW4gPSBUZXJyYWluVHlwZS5Cb3JkZXI7XG4gICAgICAgIGZsb29yLnB1c2goYyk7XG4gICAgICB9IGVsc2UgYy50ZXJyYWluID0gVGVycmFpblR5cGUuU2t5O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoYy50ZXJyYWluID09PSBUZXJyYWluVHlwZS5Sb2NrKSB7XG4gICAgICAgIGlmIChnZXRDZWxsTmVhcihjLCAwLCAtMSk/LnRlcnJhaW4gPT09IFRlcnJhaW5UeXBlLlNreSkge1xuICAgICAgICAgIGMudGVycmFpbiA9IFRlcnJhaW5UeXBlLkdyYXNzO1xuICAgICAgICAgIGlmIChjZWxsVHdvQWJvdmUpIHtcbiAgICAgICAgICAgIGlmIChjZWxsVHdvQWJvdmUudGVycmFpbiA9PT0gVGVycmFpblR5cGUuUm9jayB8fCBjZWxsVHdvQWJvdmUudGVycmFpbiA9PT0gVGVycmFpblR5cGUuR3Jhc3MpIHtcbiAgICAgICAgICAgICAgY2VsbFR3b0Fib3ZlLnRlcnJhaW4gPSBUZXJyYWluVHlwZS5Ta3k7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICAvLyBkaWcgaG9sZXMgaW4gdGhlIGZsb29yXG4gIGZsb29yID0gZmxvb3IuZmlsdGVyKChjKSA9PiB7XG4gICAgaWYgKGMueCA+IDAgJiYgYy54IDwgZmxvb3IubGVuZ3RoIC0gMSkge1xuICAgICAgbGV0IHk6IG51bWJlcjtcbiAgICAgIGxldCBjb2x1bW5DZWxsQ291bnQgPSAwO1xuICAgICAgZm9yICh5ID0gMDsgeSA8IGhlaWdodEluVGlsZXMgLSAxOyB5KyspIHtcbiAgICAgICAgY2VsbCA9IG1hcFtnZXRJbmRleChjLngsIHkpXTtcbiAgICAgICAgaWYgKCFjZWxsSXNFbXB0eShjZWxsKSkgY29sdW1uQ2VsbENvdW50Kys7XG4gICAgICB9XG4gICAgICBpZiAoY29sdW1uQ2VsbENvdW50IDwgMikgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG5cbiAgd2hpbGUgKGZsb29yLmxlbmd0aCA+IDMgJiYgaG9sZXNOdW0gPCBNQVhfSE9MRVMpIHtcbiAgICBpID0gcmFuZG9tSW50KDEsIGZsb29yLmxlbmd0aCAtIDIpO1xuICAgIGNlbGwgPSBmbG9vcltpXTtcbiAgICBjZWxsLnRlcnJhaW4gPSBUZXJyYWluVHlwZS5Ta3k7XG4gICAgY29uc3QgY2VsbEFib3ZlID0gbWFwW2dldEluZGV4KGNlbGwueCwgY2VsbC55IC0gMSldO1xuICAgIGlmICghY2VsbElzRW1wdHkoY2VsbEFib3ZlKSkgY2VsbEFib3ZlLnRlcnJhaW4gPSBUZXJyYWluVHlwZS5Ta3k7XG4gICAgZmxvb3Iuc3BsaWNlKGkgLSAxLCAzKTtcbiAgICBob2xlc051bSsrO1xuICB9XG5cbiAgbWFwLmZvckVhY2goKGM6IENlbGwpID0+IHtcbiAgICBpZiAoYy55ID4gMSAmJiBjLnRlcnJhaW4gPT09IFRlcnJhaW5UeXBlLkdyYXNzKSB7XG4gICAgICBjb25zdCBjZWxsQWJvdmUgPSBnZXRDZWxsTmVhcihjLCAwLCAtMSkhO1xuICAgICAgaXRlbUxvY2F0aW9ucy5wdXNoKGNlbGxBYm92ZSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBhZGRJdGVtc1xuICBidXN5Q2VsbHMucHVzaChwbGFjZUl0ZW0oSXRlbVR5cGUuRXhpdCwgaXRlbUxvY2F0aW9ucykpO1xuICBmb3IgKGkgPSAwOyBpIDwgbnVtQ2hlc3RzOyBpKyspIHtcbiAgICBidXN5Q2VsbHMucHVzaChwbGFjZUl0ZW0oSXRlbVR5cGUuVHJlYXN1cmUsIGl0ZW1Mb2NhdGlvbnMpKTtcbiAgfVxuICBidXN5Q2VsbHMucHVzaChwbGFjZUl0ZW0oSXRlbVR5cGUuUGxheWVyLCBpdGVtTG9jYXRpb25zKSk7XG4gIGJ1c3lDZWxscy5wdXNoKHBsYWNlSXRlbShJdGVtVHlwZS5Qb3J0YWwsIGl0ZW1Mb2NhdGlvbnMpKTtcblxuICBtYXAuZm9yRWFjaCgoYzogQ2VsbCkgPT4ge1xuICAgIGlmIChcbiAgICAgIGMueCA+IDAgJiZcbiAgICAgIGMueCA8IHdpZHRoSW5UaWxlcyAtIDEgJiZcbiAgICAgIGMueSA+IDEgJiZcbiAgICAgIChjLnRlcnJhaW4gPT09IFRlcnJhaW5UeXBlLkdyYXNzIHx8IGMudGVycmFpbiA9PT0gVGVycmFpblR5cGUuQm9yZGVyKVxuICAgICkge1xuICAgICAgY2VsbCA9IGdldENlbGxOZWFyKGMsIDAsIC0xKSE7XG4gICAgICBpZiAoXG4gICAgICAgIGJ1c3lDZWxscy5pbmRleE9mKGNlbGwpIDwgMCAmJlxuICAgICAgICBjZWxsSXNFbXB0eShjZWxsKSAmJlxuICAgICAgICAoKGNlbGxJc0VtcHR5KGdldENlbGxOZWFyKGNlbGwsIC0xLCAwKSkgJiYgIWNlbGxJc0VtcHR5KGdldENlbGxOZWFyKGNlbGwsIC0xLCAxKSkpIHx8XG4gICAgICAgICAgKGNlbGxJc0VtcHR5KGdldENlbGxOZWFyKGNlbGwsIDEsIDApKSAmJiAhY2VsbElzRW1wdHkoZ2V0Q2VsbE5lYXIoY2VsbCwgMSwgMSkpKSlcbiAgICAgICkge1xuICAgICAgICBncm91bmRTcGF3bkxvY2F0aW9ucy5wdXNoKGNlbGwpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgd2hpbGUgKGdyb3VuZFNwYXduTG9jYXRpb25zLmxlbmd0aCA+IDAgJiYgbnVtRW5lbWllcyA8IGdyb3VuZEVuZW1pZXNMaW1pdCkge1xuICAgIHBsYWNlRW5lbXkoSXRlbVR5cGUuU25ha2UsIGdyb3VuZFNwYXduTG9jYXRpb25zKTtcbiAgICBudW1FbmVtaWVzKys7XG4gIH1cblxuICBtYXAuZm9yRWFjaCgoYykgPT4ge1xuICAgIGlmIChcbiAgICAgIGMueCA+IDAgJiZcbiAgICAgIGMueCA8IHdpZHRoSW5UaWxlcyAtIDEgJiZcbiAgICAgIGNlbGxJc0VtcHR5KGMpICYmXG4gICAgICBjZWxsSXNFbXB0eShnZXRDZWxsTmVhcihjLCAwLCAtMSkpICYmXG4gICAgICBjZWxsSXNFbXB0eShnZXRDZWxsTmVhcihjLCAwLCAxKSkgJiZcbiAgICAgIGNlbGxJc0VtcHR5KGdldENlbGxOZWFyKGMsIC0xLCAwKSkgJiZcbiAgICAgIGNlbGxJc0VtcHR5KGdldENlbGxOZWFyKGMsIDEsIDApKVxuICAgICkge1xuICAgICAgYWlyU3Bhd25Mb2NhdGlvbnMucHVzaChjKTtcbiAgICB9XG4gIH0pO1xuXG4gIG51bUVuZW1pZXMgPSAwO1xuICB3aGlsZSAoYWlyU3Bhd25Mb2NhdGlvbnMubGVuZ3RoID4gMCAmJiBudW1FbmVtaWVzIDwgZmx5aW5nRW5lbWllc0xpbWl0KSB7XG4gICAgcGxhY2VFbmVteShJdGVtVHlwZS5CYXQsIGFpclNwYXduTG9jYXRpb25zKTtcbiAgICBudW1FbmVtaWVzKys7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1hcCxcbiAgICBpdGVtTG9jYXRpb25zXG4gIH07XG59O1xuXG5leHBvcnQgeyBDZWxsLCBUZXJyYWluVHlwZSwgSXRlbVR5cGUsIGdlbmVyYXRlUm9vbSB9O1xuIiwiaW1wb3J0IHsgVGlsZSB9IGZyb20gXCIuL2Fzc2V0c1wiO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tIFwiLi9jb2xvcnNcIjtcbmltcG9ydCB7IGNyZWF0ZU1vdmllQ2xpcCwgTW92aWVDbGlwLCBNb3ZpZUNsaXBQcm9wcyB9IGZyb20gXCIuL21vdmllLWNsaXBcIjtcblxuY29uc3QgZW51bSBUb2dnbGVTdGF0ZSB7XG4gIE9mZixcbiAgT25cbn1cblxuaW50ZXJmYWNlIFRvZ2dsZSBleHRlbmRzIE1vdmllQ2xpcCB7XG4gIGlzT2ZmKCk6IGJvb2xlYW47XG4gIGlzT24oKTogYm9vbGVhbjtcbiAgdHVybk9uKCk6IHZvaWQ7XG4gIC8vIHR1cm5PZmYoKTogdm9pZDtcbn1cblxuY29uc3QgY3JlYXRlVG9nZ2xlID0gKG9mZlRpbGU6IFRpbGUsIG9uVGlsZTogVGlsZSwgY29sb3I6IENvbG9yLCBvbkFscGhhID0gMSwgcHJvcHM/OiBNb3ZpZUNsaXBQcm9wcyk6IFRvZ2dsZSA9PiB7XG4gIGxldCBzdGF0ZSA9IFRvZ2dsZVN0YXRlLk9mZjtcbiAgY29uc3QgdG9nZ2xlOiBUb2dnbGUgPSBPYmplY3QuYXNzaWduKFxuICAgIGNyZWF0ZU1vdmllQ2xpcChbb2ZmVGlsZSwgb25UaWxlXSwgY29sb3IsIGZhbHNlKSxcbiAgICB7XG4gICAgICBpc09mZigpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlID09PSBUb2dnbGVTdGF0ZS5PZmY7XG4gICAgICB9LFxuICAgICAgaXNPbigpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlID09PSBUb2dnbGVTdGF0ZS5PbjtcbiAgICAgIH0sXG4gICAgICB0dXJuT24oKSB7XG4gICAgICAgIHRvZ2dsZS5zZXRJbWFnZSh0b2dnbGUuaW1hZ2VzWyhzdGF0ZSA9IFRvZ2dsZVN0YXRlLk9uKV0pO1xuICAgICAgICB0b2dnbGUuYWxwaGEgPSBvbkFscGhhO1xuICAgICAgfVxuICAgICAgLypcbiAgICB0dXJuT2ZmKCkge1xuICAgICAgdG9nZ2xlLnNldEltYWdlKHRvZ2dsZS5pbWFnZXNbKHN0YXRlID0gVG9nZ2xlU3RhdGUuT2ZmKV0pO1xuICAgICAgdG9nZ2xlLmFscGhhID0gMTtcbiAgICB9XG4gICAgKi9cbiAgICB9LFxuICAgIHByb3BzXG4gICk7XG4gIGlmIChwcm9wcykgdG9nZ2xlLmluaXQoKTtcbiAgcmV0dXJuIHRvZ2dsZTtcbn07XG5cbmV4cG9ydCB7IFRvZ2dsZSwgY3JlYXRlVG9nZ2xlIH07XG4iLCJpbXBvcnQgeyBBU1NFVFNfQk9SREVSX1NJWkUsIEFTU0VUU19PVVRMSU5FX1NJWkUsIEFTU0VUU19TQ0FMRURfVElMRV9TSVpFLCBUaWxlIH0gZnJvbSBcIi4uL2Fzc2V0c1wiO1xuaW1wb3J0IHsgY3JlYXRlQ29sb3JlZFNwcml0ZSB9IGZyb20gXCIuLi9jb2xvcmVkLXNwcml0ZVwiO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tIFwiLi4vY29sb3JzXCI7XG5pbXBvcnQgeyBDb2xsaXNpb25TaWRlLCBoaXRUZXN0UmVjdGFuZ2xlLCByZWN0YW5nbGVDb2xsaXNpb24gfSBmcm9tIFwiLi4vY29yZS9jb2xsaXNpb25cIjtcbmltcG9ydCB7IERpc3BsYXlPYmplY3QgfSBmcm9tIFwiLi4vY29yZS9kaXNwbGF5XCI7XG5pbXBvcnQgeyBiaW5kS2V5LCBpc0xlZnRLZXlEb3duLCBpc1JpZ2h0S2V5RG93biwgaXNTcGFjZURvd24gfSBmcm9tIFwiLi4vY29yZS9rZXlib2FyZFwiO1xuaW1wb3J0IHsgcmFuZG9tIH0gZnJvbSBcIi4uL2NvcmUvcmFuZG9tXCI7XG5pbXBvcnQgeyBjcmVhdGVSZWN0U2hhcGUgfSBmcm9tIFwiLi4vY29yZS9zaGFwZVwiO1xuaW1wb3J0IHsgU3ByaXRlIH0gZnJvbSBcIi4uL2NvcmUvc3ByaXRlXCI7XG5pbXBvcnQgeyBjcmVhdGVUZXh0IH0gZnJvbSBcIi4uL2NvcmUvdGV4dFwiO1xuaW1wb3J0IHsgZWFzZU91dEJhY2ssIHNpbmUsIHNtb290aHN0ZXAsIHR3ZWVuUHJvcCB9IGZyb20gXCIuLi9jb3JlL3R3ZWVuXCI7XG5pbXBvcnQgeyBjcmVhdGVFbmVteSwgY3JlYXRlR2hvc3QsIGNyZWF0ZVNuYWtlLCBFbmVteSwgR2hvc3QsIFNuYWtlIH0gZnJvbSBcIi4uL2VuZW15XCI7XG5pbXBvcnQgeyBHYW1lIH0gZnJvbSBcIi4uL2dhbWVcIjtcbmltcG9ydCB7IGNyZWF0ZUhVRCB9IGZyb20gXCIuLi9odWRcIjtcbmltcG9ydCB7IGNyZWF0ZU1vdmllQ2xpcCB9IGZyb20gXCIuLi9tb3ZpZS1jbGlwXCI7XG5pbXBvcnQgeyBjcmVhdGVQbGF5ZXIsIFBsYXllciB9IGZyb20gXCIuLi9wbGF5ZXJcIjtcbmltcG9ydCB7IENlbGwsIGdlbmVyYXRlUm9vbSwgSXRlbVR5cGUsIFRlcnJhaW5UeXBlIH0gZnJvbSBcIi4uL3Jvb21cIjtcbmltcG9ydCB7IHBsYXlTb3VuZCwgU291bmQgfSBmcm9tIFwiLi4vc291bmRzXCI7XG5pbXBvcnQgeyBjcmVhdGVUb2dnbGUsIFRvZ2dsZSB9IGZyb20gXCIuLi90b2dnbGVcIjtcbmltcG9ydCB7IGdldFJhbmRvbUVsZW1lbnQsIHNodWZmbGUsIHdhaXQgfSBmcm9tIFwiLi4vdXRpbHNcIjtcbmltcG9ydCB7IFNjcmVlbk5hbWUsIFVwZGF0ZVNjcmVlbiB9IGZyb20gXCIuL3NjcmVlblwiO1xuXG5jb25zdCBlbnVtIERyb3BUeXBlIHtcbiAgQ29pbixcbiAgS2V5LFxuICBNYWdpY1xufVxuXG50eXBlIFJvb21TdGF0ZSA9IHtcbiAgY29pbnM6IG51bWJlcjtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIGNvbG9yOiBDb2xvcjtcbiAgZ3JhdmVUaWxlOiBUaWxlO1xuICBzZWVkOiBudW1iZXI7XG59O1xuXG5jb25zdCBkZXN0cm95TWFueSA9IChsaXN0PzogQXJyYXk8RGlzcGxheU9iamVjdD4pID0+IHtcbiAgd2hpbGUgKGxpc3QgJiYgbGlzdC5sZW5ndGggPiAwKSB7XG4gICAgbGlzdC5wb3AoKSEuZGVzdHJveSgpO1xuICB9XG59O1xuXG5jb25zdCBjcmVhdGVHYW1lU2NyZWVuID0gKGdhbWU6IEdhbWUpOiBVcGRhdGVTY3JlZW4gPT4ge1xuICBsZXQgcGxhdGZvcm1zOiBBcnJheTxTcHJpdGU+O1xuICBsZXQgdHJlYXN1cmVzOiBBcnJheTxUb2dnbGU+O1xuICBsZXQgc25ha2VzOiBBcnJheTxTbmFrZT47XG4gIGxldCBiYXRzOiBBcnJheTxFbmVteT47XG4gIGxldCBkcm9wczogQXJyYXk8RHJvcFR5cGU+O1xuICBsZXQgZXhpdDogVG9nZ2xlO1xuICBsZXQgcGxheWVyOiBQbGF5ZXI7XG4gIGxldCBwb3J0YWw6IFNwcml0ZSB8IHVuZGVmaW5lZDtcbiAgbGV0IGxhc3RHcmF2ZTogU3ByaXRlIHwgdW5kZWZpbmVkO1xuICBsZXQgZ2hvc3Q6IEdob3N0IHwgdW5kZWZpbmVkO1xuICBsZXQgdGltZTogbnVtYmVyO1xuICBsZXQgcm9vbSA9IDA7XG4gIGxldCBjb2lucyA9IDA7XG4gIGxldCBsYXN0Um9vbVNlZWQgPSAtMTtcbiAgbGV0IGluVHJhbnNpdGlvbiA9IGZhbHNlO1xuXG4gIGNvbnN0IHsgc3RhZ2UgfSA9IGdhbWU7XG4gIGNvbnN0IHRpbGVTaXplID0gQVNTRVRTX1NDQUxFRF9USUxFX1NJWkU7XG4gIGNvbnN0IGJvcmRlclNpemUgPSBBU1NFVFNfQk9SREVSX1NJWkU7XG4gIGNvbnN0IG91dGxpbmVTaXplID0gQVNTRVRTX09VVExJTkVfU0laRTtcbiAgY29uc3QgaHVkID0gY3JlYXRlSFVEKHN0YWdlLndpZHRoKTtcbiAgY29uc3QgYmxhbmsgPSBjcmVhdGVSZWN0U2hhcGUoc3RhZ2Uud2lkdGgsIHN0YWdlLmhlaWdodCwgeyBjb2xvcjogQ29sb3IuQnJvd25EYXJrIH0pO1xuICBjb25zdCB3aW5MYWJlbCA9IGNyZWF0ZVRleHQoXCJZT1UgV0lOIVwiLCB0aWxlU2l6ZSAqIDIsIHsgY29sb3I6IENvbG9yLkJlaWdlIH0pO1xuICBjb25zdCBzdGF0ZXM6IEFycmF5PFJvb21TdGF0ZT4gPSBbXTtcbiAgY29uc3QgcGxheWVyQ29sb3JzID0gW0NvbG9yLkJlaWdlLCBDb2xvci5CbHVlQnJpZ2h0LCBDb2xvci5HcmVlbkJyaWdodCwgQ29sb3IuT3JhbmdlLCBDb2xvci5QdXJwbGUsIENvbG9yLlJlZF07XG4gIGNvbnN0IHBsYXllclRpbGVzID0gW1RpbGUuSGVybywgVGlsZS5LbmlnaHQsIFRpbGUuQmF0bWFuXTtcbiAgY29uc3QgcGxheWVyR3JhdmVzID0gW1RpbGUuR3JhdmUsIFRpbGUuR3JhdmUxLCBUaWxlLkdyYXZlMl07XG5cbiAgY29uc3QgaW5pdExldmVsID0gKFxuICAgIHBsYXllckNvbG9yOiBDb2xvciA9IENvbG9yLlB1cnBsZSxcbiAgICBwbGF5ZXJUaWxlOiBUaWxlID0gVGlsZS5IZXJvLFxuICAgIHBsYXllckdyYXZlVGlsZTogVGlsZSA9IFRpbGUuR3JhdmUsXG4gICAgcm9vbU5vID0gMFxuICApID0+IHtcbiAgICBpZiAoc3RhZ2UuaGFzQ2hpbGRyZW4oKSkgc3RhZ2UucmVtb3ZlQWxsKCk7XG5cbiAgICBkZXN0cm95TWFueShwbGF0Zm9ybXMpO1xuICAgIGRlc3Ryb3lNYW55KHRyZWFzdXJlcyk7XG4gICAgZGVzdHJveU1hbnkoc25ha2VzKTtcbiAgICBkZXN0cm95TWFueShiYXRzKTtcblxuICAgIGlmIChsYXN0R3JhdmUpIGxhc3RHcmF2ZS5kZXN0cm95KCk7XG4gICAgaWYgKHBvcnRhbCkgcG9ydGFsLmRlc3Ryb3koKTtcbiAgICBpZiAoZ2hvc3QpIGdob3N0LmRlc3Ryb3koKTtcbiAgICBpZiAocGxheWVyKSBwbGF5ZXIuZGVzdHJveSgpO1xuXG4gICAgcGxhdGZvcm1zID0gW107XG4gICAgdHJlYXN1cmVzID0gW107XG4gICAgc25ha2VzID0gW107XG4gICAgYmF0cyA9IFtdO1xuICAgIGRyb3BzID0gW107XG4gICAgdGltZSA9IDA7XG4gICAgbGFzdEdyYXZlID0gcG9ydGFsID0gZ2hvc3QgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAocm9vbU5vIGluIHN0YXRlcykge1xuICAgICAgY29uc3Qgc3RhdGUgPSBzdGF0ZXNbcm9vbU5vXTtcbiAgICAgIHJhbmRvbS5zZWVkID0gc3RhdGUuc2VlZDtcbiAgICAgIGxhc3RHcmF2ZSA9IGNyZWF0ZUNvbG9yZWRTcHJpdGUoc3RhdGUuZ3JhdmVUaWxlLCBzdGF0ZS5jb2xvciwge1xuICAgICAgICB4OiBzdGF0ZS54LFxuICAgICAgICB5OiBzdGF0ZS55LFxuICAgICAgICBib3JkZXJTaXplLFxuICAgICAgICBvdXRsaW5lU2l6ZVxuICAgICAgfSk7XG4gICAgICBnaG9zdCA9IGNyZWF0ZUdob3N0KHN0YXRlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmFuZG9tLnNlZWQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAyMTQ3NDgzNjQ2KTtcbiAgICB9XG5cbiAgICBsYXN0Um9vbVNlZWQgPSByYW5kb20uc2VlZDtcbiAgICBjb25zdCByb29tID0gZ2VuZXJhdGVSb29tKHtcbiAgICAgIHdpZHRoSW5UaWxlczogc3RhZ2Uud2lkdGggLyB0aWxlU2l6ZSxcbiAgICAgIGhlaWdodEluVGlsZXM6IHN0YWdlLmhlaWdodCAvIHRpbGVTaXplLFxuICAgICAgcm9vbU5vXG4gICAgfSk7XG5cbiAgICByb29tLm1hcC5mb3JFYWNoKChjZWxsKSA9PiB7XG4gICAgICBpZiAoY2VsbC50ZXJyYWluID09PSBUZXJyYWluVHlwZS5Ta3kpIHJldHVybjtcbiAgICAgIGxldCBzcHJpdGU6IFNwcml0ZTtcbiAgICAgIHN3aXRjaCAoY2VsbC50ZXJyYWluKSB7XG4gICAgICAgIGNhc2UgVGVycmFpblR5cGUuUm9jazpcbiAgICAgICAgICBzcHJpdGUgPSBjcmVhdGVDb2xvcmVkU3ByaXRlKFRpbGUuV2FsbDIsIENvbG9yLkJyb3duTGlnaHQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFRlcnJhaW5UeXBlLkdyYXNzOlxuICAgICAgICAgIHNwcml0ZSA9IGNyZWF0ZUNvbG9yZWRTcHJpdGUoVGlsZS5XYWxsMSwgQ29sb3IuQnJvd24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFRlcnJhaW5UeXBlLkJvcmRlcjpcbiAgICAgICAgICBzcHJpdGUgPSBjcmVhdGVDb2xvcmVkU3ByaXRlKFRpbGUuV2FsbCwgQ29sb3IuR3JleSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBzcHJpdGUueCA9IGNlbGwueCAqIHRpbGVTaXplO1xuICAgICAgc3ByaXRlLnkgPSBjZWxsLnkgKiB0aWxlU2l6ZTtcbiAgICAgIHBsYXRmb3Jtcy5wdXNoKHNwcml0ZSk7XG4gICAgfSk7XG5cbiAgICByb29tLm1hcC5mb3JFYWNoKChjZWxsOiBDZWxsKSA9PiB7XG4gICAgICBpZiAoY2VsbC5pdGVtICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbGV0IGNoZXN0OiBUb2dnbGUsIGVuZW15OiBFbmVteSwgc3ByaXRlOiBTcHJpdGU7XG4gICAgICAgIHN3aXRjaCAoY2VsbC5pdGVtKSB7XG4gICAgICAgICAgY2FzZSBJdGVtVHlwZS5QbGF5ZXI6XG4gICAgICAgICAgICBzcHJpdGUgPSBwbGF5ZXIgPSBjcmVhdGVQbGF5ZXIoXG4gICAgICAgICAgICAgIFtwbGF5ZXJUaWxlLCBwbGF5ZXJUaWxlICsgMSwgcGxheWVyVGlsZSwgcGxheWVyVGlsZSArIDJdLFxuICAgICAgICAgICAgICBwbGF5ZXJHcmF2ZVRpbGUsXG4gICAgICAgICAgICAgIHBsYXllckNvbG9yLFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgc2NhbGVYOiAtMSxcbiAgICAgICAgICAgICAgICBwaXZvdFg6IDAuNSxcbiAgICAgICAgICAgICAgICBwaXZvdFk6IDAuNSxcbiAgICAgICAgICAgICAgICBib3JkZXJTaXplLFxuICAgICAgICAgICAgICAgIGZyaWN0aW9uWDogMSxcbiAgICAgICAgICAgICAgICBmcmljdGlvblk6IDEsXG4gICAgICAgICAgICAgICAgZ3Jhdml0eTogMC4zLFxuICAgICAgICAgICAgICAgIGp1bXBGb3JjZTogLTYuOCxcbiAgICAgICAgICAgICAgICBpc09uR3JvdW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgIG91dGxpbmVTaXplXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgSXRlbVR5cGUuVHJlYXN1cmU6XG4gICAgICAgICAgICBjaGVzdCA9IHNwcml0ZSA9IGNyZWF0ZVRvZ2dsZShUaWxlLkNoZXN0Q2xvc2VkLCBUaWxlLkNoZXN0T3BlbmVkLCBDb2xvci5Hb2xkLCAwLjQpO1xuICAgICAgICAgICAgdHJlYXN1cmVzLnB1c2goY2hlc3QpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlIEl0ZW1UeXBlLkV4aXQ6XG4gICAgICAgICAgICBleGl0ID0gc3ByaXRlID0gY3JlYXRlVG9nZ2xlKFRpbGUuRG9vckNsb3NlZCwgVGlsZS5Eb29yT3BlbmVkLCBDb2xvci5CbG9vZCk7XG4gICAgICAgICAgICBleGl0LnR1cm5PbigpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlIEl0ZW1UeXBlLlBvcnRhbDpcbiAgICAgICAgICAgIHBvcnRhbCA9IHNwcml0ZSA9IGNyZWF0ZUNvbG9yZWRTcHJpdGUoVGlsZS5Wb3J0ZXgsIENvbG9yLkJsdWUsIHtcbiAgICAgICAgICAgICAgcGl2b3RYOiAwLjUsXG4gICAgICAgICAgICAgIHBpdm90WTogMC41LFxuICAgICAgICAgICAgICBib3JkZXJTaXplXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSBJdGVtVHlwZS5TbmFrZTpcbiAgICAgICAgICAgIHNuYWtlcy5wdXNoKChzcHJpdGUgPSBjcmVhdGVTbmFrZSgpKSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgSXRlbVR5cGUuQmF0OlxuICAgICAgICAgICAgZW5lbXkgPSBzcHJpdGUgPSBjcmVhdGVFbmVteShUaWxlLkJhdCwgQ29sb3IuR3JleSwge1xuICAgICAgICAgICAgICBwaXZvdFg6IDAuNSxcbiAgICAgICAgICAgICAgdng6IDEsXG4gICAgICAgICAgICAgIHNjYWxlWDogLTFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYmF0cy5wdXNoKGVuZW15KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHNwcml0ZS54ID0gY2VsbC54ICogdGlsZVNpemUgKyAodGlsZVNpemUgLSBzcHJpdGUud2lkdGgpIC8gMjtcbiAgICAgICAgc3ByaXRlLnkgPSBjZWxsLnkgKiB0aWxlU2l6ZSArICh0aWxlU2l6ZSAtIHNwcml0ZS5oZWlnaHQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHJvb21ObyA9PT0gMCkge1xuICAgICAgZHJvcHMgPSBbRHJvcFR5cGUuS2V5LCBEcm9wVHlwZS5Db2luLCBEcm9wVHlwZS5Db2luLCBEcm9wVHlwZS5Db2luXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZHJvcHMgPSBuZXcgQXJyYXkodHJlYXN1cmVzLmxlbmd0aCAtIDEpLmZpbGwoRHJvcFR5cGUuQ29pbik7XG4gICAgICBpZiAoTWF0aC5yYW5kb20oKSA8IDAuMSkgZHJvcHNbMF0gPSBEcm9wVHlwZS5NYWdpYztcbiAgICAgIGRyb3BzLnB1c2goRHJvcFR5cGUuS2V5KTtcbiAgICAgIHNodWZmbGUoZHJvcHMpO1xuICAgIH1cblxuICAgIGlmIChnaG9zdCkgZ2hvc3QudGFyZ2V0ID0gcGxheWVyO1xuICAgIHNuYWtlcy5mb3JFYWNoKChzbmFrZSkgPT4gKHNuYWtlLnRhcmdldCA9IHBsYXllcikpO1xuXG4gICAgc3RhZ2UuYWRkTWFueShodWQsIC4uLnBsYXRmb3JtcywgLi4udHJlYXN1cmVzLCBleGl0LCAuLi5zbmFrZXMsIC4uLmJhdHMsIGxhc3RHcmF2ZSEsIGdob3N0ISwgcGxheWVyKTtcbiAgfTtcblxuICBjb25zdCByZXNldExldmVsID0gKCkgPT4ge1xuICAgIGh1ZC5zZXRSb29tTm8oKHJvb20gPSAwKSk7XG4gICAgaHVkLnNldENvaW5zQ291bnQoKGNvaW5zID0gMCkpO1xuXG4gICAgaW5pdExldmVsKGdldFJhbmRvbUVsZW1lbnQocGxheWVyQ29sb3JzKSwgZ2V0UmFuZG9tRWxlbWVudChwbGF5ZXJUaWxlcyksIGdldFJhbmRvbUVsZW1lbnQocGxheWVyR3JhdmVzKSk7XG4gIH07XG5cbiAgY29uc3QgZW5kTGV2ZWwgPSAoKSA9PiB7XG4gICAgaW5UcmFuc2l0aW9uID0gdHJ1ZTtcbiAgICB3YWl0KDUwMCkudGhlbigoKSA9PiB7XG4gICAgICBzdGFnZS5hZGRDaGlsZChibGFuayk7XG4gICAgICB0d2VlblByb3AoXG4gICAgICAgIDMwLFxuICAgICAgICAoYmxhbmsuYWxwaGEgPSAwKSxcbiAgICAgICAgMSxcbiAgICAgICAgc21vb3Roc3RlcCxcbiAgICAgICAgKGEpID0+IHtcbiAgICAgICAgICBibGFuay5hbHBoYSA9IGE7XG4gICAgICAgIH0sXG4gICAgICAgICgpID0+IHtcbiAgICAgICAgICBpZiAocm9vbSA+IDApXG4gICAgICAgICAgICBzdGF0ZXNbcm9vbV0gPSB7XG4gICAgICAgICAgICAgIGNvaW5zLFxuICAgICAgICAgICAgICBjb2xvcjogcGxheWVyLmNvbG9yISxcbiAgICAgICAgICAgICAgc2VlZDogbGFzdFJvb21TZWVkLFxuICAgICAgICAgICAgICB4OiBwbGF5ZXIueCxcbiAgICAgICAgICAgICAgeTogcGxheWVyLnksXG4gICAgICAgICAgICAgIGdyYXZlVGlsZTogcGxheWVyLmdyYXZlVGlsZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIHJlc2V0TGV2ZWwoKTtcbiAgICAgICAgICBpblRyYW5zaXRpb24gPSBmYWxzZTtcblxuICAgICAgICAgIHN0YWdlLmFkZENoaWxkKGJsYW5rKTtcbiAgICAgICAgICB0d2VlblByb3AoMzAsIChibGFuay5hbHBoYSA9IDEpLCAwLCBzbW9vdGhzdGVwLCAoYSkgPT4gKGJsYW5rLmFscGhhID0gYSkpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGdhbWVPdmVyID0gKCkgPT4ge1xuICAgIC8vIEZhZGUgaW5cbiAgICBzdGFnZS5hZGRDaGlsZChibGFuayk7XG4gICAgc3RhZ2UuYWRkQ2hpbGQod2luTGFiZWwpO1xuICAgIHdpbkxhYmVsLnkgPSAoc3RhZ2UuaGVpZ2h0IC0gd2luTGFiZWwuaGVpZ2h0KSAvIDI7XG5cbiAgICB0d2VlblByb3AoXG4gICAgICA0NSxcbiAgICAgIChibGFuay5hbHBoYSA9IHdpbkxhYmVsLmFscGhhID0gMCksXG4gICAgICAxLFxuICAgICAgc21vb3Roc3RlcCxcbiAgICAgIChhKSA9PiB7XG4gICAgICAgIGJsYW5rLmFscGhhID0gd2luTGFiZWwuYWxwaGEgPSBhO1xuICAgICAgICB3aW5MYWJlbC54ID0gKHN0YWdlLndpZHRoIC0gd2luTGFiZWwud2lkdGgpIC8gMjtcbiAgICAgIH0sXG4gICAgICAoKSA9PiB7XG4gICAgICAgIGRlc3Ryb3koKTtcbiAgICAgICAgZ2FtZS5jaGFuZ2VTY3JlZW4oU2NyZWVuTmFtZS5IaWdoU2NvcmVzLCBjb2lucywgcGxheWVyLmNvbG9yKTtcbiAgICAgIH1cbiAgICApO1xuICB9O1xuXG4gIGNvbnN0IGRlc3Ryb3kgPSAoKSA9PiB7XG4gICAgc3RhZ2UucmVtb3ZlQWxsKCk7XG5cbiAgICBwbGF0Zm9ybXMgPSBbXTtcbiAgICB0cmVhc3VyZXMgPSBbXTtcbiAgICBkcm9wcyA9IFtdO1xuICAgIHNuYWtlcyA9IFtdO1xuICAgIGJhdHMgPSBbXTtcbiAgfTtcblxuICBpbml0TGV2ZWwoZ2V0UmFuZG9tRWxlbWVudChwbGF5ZXJDb2xvcnMpLCBnZXRSYW5kb21FbGVtZW50KHBsYXllclRpbGVzKSwgZ2V0UmFuZG9tRWxlbWVudChwbGF5ZXJHcmF2ZXMpKTtcblxuICAvLyBGYWRlIG91dFxuICBzdGFnZS5hZGRDaGlsZChibGFuayk7XG4gIHR3ZWVuUHJvcChcbiAgICA0NSxcbiAgICAxLFxuICAgIDAsXG4gICAgc21vb3Roc3RlcCxcbiAgICAoYSkgPT4gKGJsYW5rLmFscGhhID0gYSksXG4gICAgKCkgPT4gc3RhZ2UucmVtb3ZlQ2hpbGQoYmxhbmspXG4gICk7XG5cbiAgY29uc3Qga2V5UiA9IGJpbmRLZXkoODIpO1xuICBrZXlSLnJlbGVhc2UgPSByZXNldExldmVsO1xuXG4gIHJldHVybiAoZHQ6IG51bWJlcikgPT4ge1xuICAgIGlmIChpblRyYW5zaXRpb24pIHJldHVybjtcblxuICAgIHRpbWUgKz0gZHQ7XG5cbiAgICBpZiAocG9ydGFsICYmIHBvcnRhbC5zdGFnZSkge1xuICAgICAgcG9ydGFsLnJvdGF0aW9uICs9IE1hdGguUEkgLyA5MDtcbiAgICAgIHBvcnRhbC5zY2FsZVggPSBwb3J0YWwuc2NhbGVZID0gMSArIE1hdGguc2luKHRpbWUpICogMC41O1xuXG4gICAgICBpZiAocGxheWVyLnN0YWdlICYmIGhpdFRlc3RSZWN0YW5nbGUocGxheWVyLCBwb3J0YWwpKSB7XG4gICAgICAgIHN0YWdlLnJlbW92ZUNoaWxkKHBsYXllcik7XG4gICAgICAgIGdhbWVPdmVyKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFwbGF5ZXIuc3RhZ2UpIHJldHVybjtcblxuICAgIC8vIGNvbnRyb2xzXG4gICAgaWYgKHBsYXllci5pc0FsaXZlKCkpIHtcbiAgICAgIGlmIChpc0xlZnRLZXlEb3duKSB7XG4gICAgICAgIHBsYXllci5hY2NYID0gLTAuMjtcbiAgICAgICAgcGxheWVyLnNjYWxlWCA9IDE7XG4gICAgICB9IGVsc2UgaWYgKGlzUmlnaHRLZXlEb3duKSB7XG4gICAgICAgIHBsYXllci5hY2NYID0gMC4yO1xuICAgICAgICBwbGF5ZXIuc2NhbGVYID0gLTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwbGF5ZXIuYWNjWCA9IDA7XG4gICAgICB9XG4gICAgICBpZiAoaXNTcGFjZURvd24pIHtcbiAgICAgICAgaWYgKHBsYXllci5pc09uR3JvdW5kKSB7XG4gICAgICAgICAgcGxheVNvdW5kKFNvdW5kLkp1bXApO1xuICAgICAgICAgIHBsYXllci52eSArPSBwbGF5ZXIuanVtcEZvcmNlO1xuICAgICAgICAgIHBsYXllci5pc09uR3JvdW5kID0gZmFsc2U7XG4gICAgICAgICAgcGxheWVyLmZyaWN0aW9uWCA9IDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocGxheWVyLmlzT25Hcm91bmQpIHtcbiAgICAgIHBsYXllci5mcmljdGlvblggPSAwLjkyO1xuICAgIH0gZWxzZSB7XG4gICAgICBwbGF5ZXIuZnJpY3Rpb25YID0gMC45NztcbiAgICB9XG5cbiAgICBwbGF5ZXIudnggKz0gcGxheWVyLmFjY1g7XG4gICAgcGxheWVyLnZ5ICs9IHBsYXllci5hY2NZO1xuXG4gICAgcGxheWVyLnZ4ICo9IHBsYXllci5mcmljdGlvblg7XG5cbiAgICBwbGF5ZXIudnkgKz0gcGxheWVyLmdyYXZpdHk7XG5cbiAgICBwbGF5ZXIueCArPSBwbGF5ZXIudng7XG4gICAgcGxheWVyLnkgKz0gcGxheWVyLnZ5O1xuXG4gICAgLy8gY29sbGlzaW9uXG4gICAgcGxhdGZvcm1zLmZvckVhY2goKHBsYXRmb3JtKSA9PiB7XG4gICAgICBjb25zdCBjb2xsaXNpb24gPSByZWN0YW5nbGVDb2xsaXNpb24ocGxheWVyLCBwbGF0Zm9ybSk7XG4gICAgICBpZiAoY29sbGlzaW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3dpdGNoIChjb2xsaXNpb24pIHtcbiAgICAgICAgICBjYXNlIENvbGxpc2lvblNpZGUuQm90dG9tOlxuICAgICAgICAgICAgaWYgKHBsYXllci52eSA+PSAwKSB7XG4gICAgICAgICAgICAgIHBsYXllci5pc09uR3JvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgcGxheWVyLnZ5ID0gLXBsYXllci5ncmF2aXR5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBDb2xsaXNpb25TaWRlLlRvcDpcbiAgICAgICAgICAgIGlmIChwbGF5ZXIudnkgPD0gMCkgcGxheWVyLnZ5ID0gMDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgQ29sbGlzaW9uU2lkZS5SaWdodDpcbiAgICAgICAgICAgIGlmIChwbGF5ZXIudnggPj0gMCkgcGxheWVyLnZ4ID0gMDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgQ29sbGlzaW9uU2lkZS5MZWZ0OlxuICAgICAgICAgICAgaWYgKHBsYXllci52eCA8PSAwKSBwbGF5ZXIudnggPSAwO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbGxpc2lvbiAhPT0gQ29sbGlzaW9uU2lkZS5Cb3R0b20gJiYgcGxheWVyLnZ5ID4gMCkge1xuICAgICAgICAgIHBsYXllci5pc09uR3JvdW5kID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHNuYWtlcyA9IHNuYWtlcy5maWx0ZXIoKHNuYWtlKSA9PiB7XG4gICAgICBpZiAocmVjdGFuZ2xlQ29sbGlzaW9uKHBsYXllciwgc25ha2UsIHRydWUpKSB7XG4gICAgICAgIGlmIChwbGF5ZXIuaXNBbGl2ZSgpKSBwbGF5ZXIuZGllKCk7XG4gICAgICAgIHN0YWdlLnJlbW92ZUNoaWxkKHNuYWtlKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG5cbiAgICAvLyBjbGFtcFxuICAgIGlmIChwbGF5ZXIueCA8IHRpbGVTaXplIC8gMiAtIHBsYXllci53aWR0aCkgcGxheWVyLnggPSBzdGFnZS53aWR0aCAtIHRpbGVTaXplICsgcGxheWVyLndpZHRoO1xuICAgIGlmIChwbGF5ZXIueCA+IHN0YWdlLndpZHRoIC0gdGlsZVNpemUgKyBwbGF5ZXIud2lkdGgpIHBsYXllci54ID0gdGlsZVNpemUgLyAyIC0gcGxheWVyLndpZHRoO1xuICAgIGlmIChwbGF5ZXIueSArIHBsYXllci5oZWlnaHQgPiBzdGFnZS5oZWlnaHQpIHBsYXllci55ID0gLXBsYXllci5oZWlnaHQ7XG5cbiAgICBpZiAoIXBsYXllci5pc0FsaXZlKCkpIHtcbiAgICAgIGlmIChNYXRoLmFicyhwbGF5ZXIudngpIDwgMC4wMSAmJiBNYXRoLmFicyhwbGF5ZXIudnkpIDwgMC4wMSAmJiBwbGF5ZXIuaXNPbkdyb3VuZCkgZW5kTGV2ZWwoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZ2hvc3QgJiYgcmVjdGFuZ2xlQ29sbGlzaW9uKHBsYXllciwgZ2hvc3QsIHRydWUpKSBwbGF5ZXIuZGllKCk7XG5cbiAgICBpZiAobGFzdEdyYXZlICYmIGhpdFRlc3RSZWN0YW5nbGUocGxheWVyLCBsYXN0R3JhdmUpKSB7XG4gICAgICBzdGFnZS5yZW1vdmVDaGlsZChsYXN0R3JhdmUpO1xuICAgICAgc3RhZ2UucmVtb3ZlQ2hpbGQoZ2hvc3QhKTtcbiAgICAgIGxhc3RHcmF2ZSA9IGdob3N0ID0gdW5kZWZpbmVkO1xuXG4gICAgICBodWQuc2V0Q29pbnNDb3VudCgoY29pbnMgKz0gc3RhdGVzW3Jvb21dLmNvaW5zKSk7XG4gICAgICBkZWxldGUgc3RhdGVzW3Jvb21dO1xuXG4gICAgICBwbGF5U291bmQoU291bmQuQ29pbik7XG4gICAgfVxuXG4gICAgYmF0cy5mb3JFYWNoKChiYXQpID0+IHtcbiAgICAgIGJhdC54ICs9IGJhdC52eDtcbiAgICAgIGJhdC55ID0gYmF0LnkgKyBNYXRoLnNpbih0aW1lKTtcblxuICAgICAgZm9yIChjb25zdCBwbGF0Zm9ybSBvZiBwbGF0Zm9ybXMpIHtcbiAgICAgICAgaWYgKGhpdFRlc3RSZWN0YW5nbGUoYmF0LCBwbGF0Zm9ybSkpIHtcbiAgICAgICAgICBiYXQudnggKj0gLTE7XG4gICAgICAgICAgYmF0LnNjYWxlWCAqPSAtMTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoYmF0LnggPCAwIHx8IGJhdC54ID4gc3RhZ2Uud2lkdGggLSBiYXQud2lkdGgpIHtcbiAgICAgICAgYmF0LnZ4ICo9IC0xO1xuICAgICAgICBiYXQuc2NhbGVYICo9IC0xO1xuICAgICAgfVxuXG4gICAgICBpZiAoaGl0VGVzdFJlY3RhbmdsZShwbGF5ZXIsIGJhdCkpIHBsYXllci5kaWUoKTtcbiAgICB9KTtcblxuICAgIC8vIGxvb3RcbiAgICB0cmVhc3VyZXMuZm9yRWFjaCgoY2hlc3QpID0+IHtcbiAgICAgIGlmIChjaGVzdC5pc09mZigpICYmIGhpdFRlc3RSZWN0YW5nbGUocGxheWVyLCBjaGVzdCkpIHtcbiAgICAgICAgaHVkLnNldENvaW5zQ291bnQoKytjb2lucyk7XG4gICAgICAgIHBsYXlTb3VuZChTb3VuZC5Db2luKTtcblxuICAgICAgICBjb25zdCBvbGRDaGVzdEhlaWdodCA9IGNoZXN0LmhlaWdodDtcbiAgICAgICAgY2hlc3QudHVybk9uKCk7XG4gICAgICAgIGNoZXN0LnkgLT0gY2hlc3QuaGVpZ2h0IC0gb2xkQ2hlc3RIZWlnaHQ7XG5cbiAgICAgICAgbGV0IGxvb3Q6IFNwcml0ZTtcbiAgICAgICAgY29uc3QgZHJvcCA9IGRyb3BzLnBvcCgpITtcbiAgICAgICAgc3dpdGNoIChkcm9wKSB7XG4gICAgICAgICAgY2FzZSBEcm9wVHlwZS5Db2luOlxuICAgICAgICAgICAgLy8gVE9ETzogY2hlY2sgcG9zXG4gICAgICAgICAgICBsb290ID0gY3JlYXRlTW92aWVDbGlwKFtUaWxlLkNvaW4sIFRpbGUuQ29pbjEsIFRpbGUuQ29pbjIsIFRpbGUuQ29pbjNdLCBDb2xvci5Hb2xkLCB0cnVlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRHJvcFR5cGUuS2V5OlxuICAgICAgICAgICAgbG9vdCA9IGNyZWF0ZUNvbG9yZWRTcHJpdGUoVGlsZS5LZXksIENvbG9yLkdvbGQsIHtcbiAgICAgICAgICAgICAgYm9yZGVyU2l6ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIERyb3BUeXBlLk1hZ2ljOlxuICAgICAgICAgICAgbG9vdCA9IGNyZWF0ZUNvbG9yZWRTcHJpdGUoVGlsZS5IYXQsIENvbG9yLkJsdWUsIHtcbiAgICAgICAgICAgICAgYm9yZGVyU2l6ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBsb290LnggPSBjaGVzdC54ICsgKGNoZXN0LndpZHRoIC0gbG9vdC53aWR0aCkgLyAyICsgYm9yZGVyU2l6ZTtcbiAgICAgICAgbG9vdC55ID0gY2hlc3QueTtcbiAgICAgICAgc3RhZ2UuYWRkQ2hpbGQobG9vdCk7XG5cbiAgICAgICAgdHdlZW5Qcm9wKFxuICAgICAgICAgIDE1LFxuICAgICAgICAgIChsb290LmFscGhhID0gMCksXG4gICAgICAgICAgMSxcbiAgICAgICAgICBlYXNlT3V0QmFjayxcbiAgICAgICAgICAocmF0aW8pID0+IHtcbiAgICAgICAgICAgIGxvb3QueSA9IGNoZXN0LnkgLSAodGlsZVNpemUgLyAyICsgY2hlc3QuaGVpZ2h0KSAqIHJhdGlvO1xuICAgICAgICAgICAgbG9vdC5hbHBoYSA9IHJhdGlvO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgbG9vdC55ID0gY2hlc3QueSAtICh0aWxlU2l6ZSAvIDIgKyBjaGVzdC5oZWlnaHQpO1xuICAgICAgICAgICAgbG9vdC5hbHBoYSA9IDE7XG5cbiAgICAgICAgICAgIHdhaXQoMzUwKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgdHdlZW5Qcm9wKFxuICAgICAgICAgICAgICAgIDE1LFxuICAgICAgICAgICAgICAgIChsb290LmFscGhhID0gMSksXG4gICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICBzaW5lLFxuICAgICAgICAgICAgICAgIChyYXRpbykgPT4ge1xuICAgICAgICAgICAgICAgICAgbG9vdC5hbHBoYSA9IHJhdGlvO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgbG9vdC5hbHBoYSA9IDA7XG4gICAgICAgICAgICAgICAgICBpZiAobG9vdC5zdGFnZSkge1xuICAgICAgICAgICAgICAgICAgICBzdGFnZS5yZW1vdmVDaGlsZChsb290KTtcbiAgICAgICAgICAgICAgICAgICAgbG9vdC5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChkcm9wID09PSBEcm9wVHlwZS5LZXkpIGV4aXQudHVybk9uKCk7XG4gICAgICAgIGVsc2UgaWYgKGRyb3AgPT09IERyb3BUeXBlLk1hZ2ljKSB7XG4gICAgICAgICAgaWYgKHBvcnRhbCAmJiAhcG9ydGFsLnN0YWdlKSBzdGFnZS5hZGRDaGlsZChwb3J0YWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoZXhpdC5pc09uKCkgJiYgaGl0VGVzdFJlY3RhbmdsZShwbGF5ZXIsIGV4aXQpKSB7XG4gICAgICBodWQuc2V0Um9vbU5vKCsrcm9vbSk7XG4gICAgICBpbml0TGV2ZWwocGxheWVyLmNvbG9yLCBwbGF5ZXIudGlsZSwgcGxheWVyLmdyYXZlVGlsZSwgcm9vbSk7XG4gICAgfVxuICB9O1xufTtcblxuZXhwb3J0IHsgY3JlYXRlR2FtZVNjcmVlbiB9O1xuIiwiaW1wb3J0IHsgQVNTRVRTX1NDQUxFRF9JVEVNX1NJWkUsIEFTU0VUU19TQ0FMRURfVElMRV9TSVpFLCBUaWxlIH0gZnJvbSBcIi4uL2Fzc2V0c1wiO1xuaW1wb3J0IHsgY3JlYXRlQ29sb3JlZFNwcml0ZSB9IGZyb20gXCIuLi9jb2xvcmVkLXNwcml0ZVwiO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tIFwiLi4vY29sb3JzXCI7XG5pbXBvcnQgeyBjcmVhdGVSZWN0U2hhcGUgfSBmcm9tIFwiLi4vY29yZS9zaGFwZVwiO1xuaW1wb3J0IHsgdW5sb2NrQXVkaW8gfSBmcm9tIFwiLi4vY29yZS9zb3VuZC9hdWRpb1wiO1xuaW1wb3J0IHsgY3JlYXRlVGV4dCB9IGZyb20gXCIuLi9jb3JlL3RleHRcIjtcbmltcG9ydCB7IHNtb290aHN0ZXAsIHR3ZWVuUHJvcCB9IGZyb20gXCIuLi9jb3JlL3R3ZWVuXCI7XG5pbXBvcnQgeyBHYW1lIH0gZnJvbSBcIi4uL2dhbWVcIjtcbmltcG9ydCB7IHBhZFplcm9zLCB3YWl0IH0gZnJvbSBcIi4uL3V0aWxzXCI7XG5pbXBvcnQgeyBTY3JlZW5OYW1lLCBVcGRhdGVTY3JlZW4gfSBmcm9tIFwiLi9zY3JlZW5cIjtcblxudHlwZSBSZWNvcmQgPSBbbnVtYmVyLCBzdHJpbmcsIHN0cmluZ107XG5cbmNvbnN0IFNUT1JBR0VfS0VZID0gXCJlbmNoYW50ZWRfZHVuZ2Vvbl9zY29yZXNcIjtcbmNvbnN0IE1BWF9SRUNPUkRTX0xFTiA9IDEwMDtcblxubGV0IHJlY29yZHM6IEFycmF5PFJlY29yZD4gPSBbXTtcblxuY29uc3QgY3JlYXRlSGlnaFNjb3Jlc1NjcmVlbiA9IChnYW1lOiBHYW1lLCBzY29yZTogbnVtYmVyLCBjb2xvcjogc3RyaW5nKTogVXBkYXRlU2NyZWVuID0+IHtcbiAgY29uc3QgdGlsZVNpemUgPSBBU1NFVFNfU0NBTEVEX1RJTEVfU0laRTtcbiAgY29uc3QgdGV4dFNpemUgPSBBU1NFVFNfU0NBTEVEX0lURU1fU0laRTtcbiAgY29uc3QgeyBzdGFnZSB9ID0gZ2FtZTtcbiAgY29uc3QgdGl0bGUgPSBjcmVhdGVUZXh0KFwiSElHSCBTQ09SRVNcIiwgdGlsZVNpemUsIHsgeTogdGlsZVNpemUsIGNvbG9yOiBDb2xvci5CZWlnZSB9KTtcbiAgY29uc3QgY2FuZGxlTGVmdCA9IGNyZWF0ZUNvbG9yZWRTcHJpdGUoVGlsZS5DYW5kbGUsIENvbG9yLk9yYW5nZSwgeyB5OiB0aWxlU2l6ZSB9KTtcbiAgY29uc3QgY2FuZGxlUmlnaHQgPSBjcmVhdGVDb2xvcmVkU3ByaXRlKFRpbGUuQ2FuZGxlLCBDb2xvci5PcmFuZ2UsIHsgeTogdGlsZVNpemUsIHBpdm90WDogMC41LCBzY2FsZVg6IC0xIH0pO1xuICBjb25zdCBiYWNrTGFiZWwgPSBjcmVhdGVUZXh0KFwiQU5ZIEtFWVwiLCB0aWxlU2l6ZSAvIDIsIHsgeTogc3RhZ2UuaGVpZ2h0IC0gdGlsZVNpemUgKiAxLjUgfSk7XG4gIGNvbnN0IGJsYW5rID0gY3JlYXRlUmVjdFNoYXBlKHN0YWdlLndpZHRoLCBzdGFnZS5oZWlnaHQsIHsgY29sb3I6IENvbG9yLkJyb3duRGFyayB9KTtcbiAgY29uc3Qga2V5VXBIYW5kbGVyID0gKGV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIGtleVVwSGFuZGxlcik7XG4gICAgLy8gRmFkZSBpblxuICAgIHR3ZWVuUHJvcChcbiAgICAgIDQ1LFxuICAgICAgMCxcbiAgICAgIDEsXG4gICAgICBzbW9vdGhzdGVwLFxuICAgICAgKGEpID0+IChibGFuay5hbHBoYSA9IGEpLFxuICAgICAgKCkgPT4ge1xuICAgICAgICBzdGFnZS5yZW1vdmVBbGwoKTtcbiAgICAgICAgZ2FtZS5jaGFuZ2VTY3JlZW4oU2NyZWVuTmFtZS5TdGFydCk7XG4gICAgICB9XG4gICAgKTtcbiAgfTtcblxuICBsZXQgaTogbnVtYmVyO1xuICBsZXQgdCA9IDA7XG5cbiAgaWYgKHNjb3JlID4gMCkge1xuICAgIGNvbnN0IG5hbWUgPSBwcm9tcHQoXCJQbGVhc2UsIGVudGVyIHlvdXIgbmFtZSAoOCBjaGFycyBtYXgpOlwiLCBcIlBsYXllciAxXCIpO1xuICAgIHdhaXQoNTAwKS50aGVuKCgpID0+IHVubG9ja0F1ZGlvKHRydWUpKTtcbiAgICBpZiAobmFtZSkgcmVjb3Jkcy5wdXNoKFtzY29yZSwgbmFtZS5zdWJzdHJpbmcoMCwgOCksIGNvbG9yXSk7XG4gIH1cbiAgcmVjb3Jkcy5zb3J0KChhLCBiKSA9PiBiWzBdIC0gYVswXSk7XG5cbiAgc2F2ZVJlY29yZHMoKTtcblxuICBmb3IgKGkgPSAwOyBpIDwgTWF0aC5taW4ocmVjb3Jkcy5sZW5ndGgsIDYpOyBpKyspIHtcbiAgICBjb25zdCBbc2NvcmUsIG5hbWUsIGNvbG9yXSA9IHJlY29yZHNbaV07XG4gICAgY29uc3QgeSA9IHRpbGVTaXplICogMyArIGkgKiB0ZXh0U2l6ZSAqIDEuNTtcbiAgICBjb25zdCBvZmZYID0gdGlsZVNpemUgLyAyO1xuICAgIGNvbnN0IHNjcmVlbldpZHRoID0gc3RhZ2Uud2lkdGggLSB0aWxlU2l6ZTtcbiAgICBjb25zdCBwb3NMYWJlbCA9IGNyZWF0ZVRleHQocGFkWmVyb3MoMiwgaSArIDEpLCB0ZXh0U2l6ZSwge1xuICAgICAgeDogb2ZmWCArIChzY3JlZW5XaWR0aCAvIDEwKSAqIDIsXG4gICAgICB5LFxuICAgICAgY29sb3JcbiAgICB9KTtcbiAgICBjb25zdCBzY29yZUxhYmVsID0gY3JlYXRlVGV4dChwYWRaZXJvcyg3LCBzY29yZSksIHRleHRTaXplLCB7XG4gICAgICB4OiBvZmZYICsgKHNjcmVlbldpZHRoIC8gMTApICogMyxcbiAgICAgIHksXG4gICAgICBjb2xvclxuICAgIH0pO1xuICAgIGNvbnN0IG5hbWVMYWJlbCA9IGNyZWF0ZVRleHQobmFtZS50b1VwcGVyQ2FzZSgpLCB0ZXh0U2l6ZSwge1xuICAgICAgeDogb2ZmWCArIChzY3JlZW5XaWR0aCAvIDEwKSAqIDYsXG4gICAgICB5LFxuICAgICAgY29sb3JcbiAgICB9KTtcbiAgICBzdGFnZS5hZGRNYW55KHBvc0xhYmVsLCBzY29yZUxhYmVsLCBuYW1lTGFiZWwpO1xuICB9XG5cbiAgc3RhZ2UuYWRkTWFueSh0aXRsZSwgY2FuZGxlTGVmdCwgY2FuZGxlUmlnaHQsIGJhY2tMYWJlbCwgYmxhbmspO1xuXG4gIC8vIEZhZGUgb3V0XG4gIHR3ZWVuUHJvcChcbiAgICA0NSxcbiAgICAxLFxuICAgIDAsXG4gICAgc21vb3Roc3RlcCxcbiAgICAoYSkgPT4gKGJsYW5rLmFscGhhID0gYSksXG4gICAgKCkgPT4gKGJsYW5rLmFscGhhID0gMClcbiAgKTtcblxuICBhZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwga2V5VXBIYW5kbGVyKTtcblxuICByZXR1cm4gKCkgPT4ge1xuICAgIHRpdGxlLnggPSAoc3RhZ2Uud2lkdGggLSB0aXRsZS53aWR0aCkgLyAyO1xuICAgIGNhbmRsZUxlZnQueCA9IHRpdGxlLnggLSBjYW5kbGVMZWZ0LndpZHRoO1xuICAgIGNhbmRsZVJpZ2h0LnggPSB0aXRsZS54ICsgdGl0bGUud2lkdGggKyA1OyAvLyBhZGQgY2hhciBzaXplXG4gICAgYmFja0xhYmVsLnggPSAoc3RhZ2Uud2lkdGggLSBiYWNrTGFiZWwud2lkdGgpIC8gMjtcblxuICAgIGlmICh0KysgJSA0MCA9PT0gMCkgYmFja0xhYmVsLmFscGhhID0gYmFja0xhYmVsLmFscGhhID09PSAwID8gMSA6IDA7XG4gIH07XG59O1xuXG5jb25zdCBsb2FkUmVjb3JkcyA9ICgpID0+IHtcbiAgY29uc3QgcmF3ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oU1RPUkFHRV9LRVkpO1xuICBpZiAocmF3KSByZWNvcmRzID0gSlNPTi5wYXJzZShyYXcpO1xufTtcblxuY29uc3Qgc2F2ZVJlY29yZHMgPSAoKSA9PiB7XG4gIGlmIChyZWNvcmRzLmxlbmd0aCA+IE1BWF9SRUNPUkRTX0xFTikgcmVjb3Jkcy5sZW5ndGggPSBNQVhfUkVDT1JEU19MRU47XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFNUT1JBR0VfS0VZLCBKU09OLnN0cmluZ2lmeShyZWNvcmRzKSk7XG59O1xuXG5leHBvcnQgeyBjcmVhdGVIaWdoU2NvcmVzU2NyZWVuLCBsb2FkUmVjb3JkcyB9O1xuIiwiaW1wb3J0IHsgQVNTRVRTX1NDQUxFRF9JVEVNX1NJWkUsIEFTU0VUU19TQ0FMRURfVElMRV9TSVpFLCBUaWxlIH0gZnJvbSBcIi4uL2Fzc2V0c1wiO1xuaW1wb3J0IHsgY3JlYXRlQ29sb3JlZFNwcml0ZSB9IGZyb20gXCIuLi9jb2xvcmVkLXNwcml0ZVwiO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tIFwiLi4vY29sb3JzXCI7XG5pbXBvcnQgeyBFTlRFUiwgS0VZX0RPV04sIEtFWV9MRUZULCBLRVlfUklHSFQsIEtFWV9VUCwgU1BBQ0UgfSBmcm9tIFwiLi4vY29yZS9rZXlib2FyZFwiO1xuaW1wb3J0IHsgY3JlYXRlUmVjdFNoYXBlIH0gZnJvbSBcIi4uL2NvcmUvc2hhcGVcIjtcbmltcG9ydCB7IGNyZWF0ZVRleHQgfSBmcm9tIFwiLi4vY29yZS90ZXh0XCI7XG5pbXBvcnQgeyBzbW9vdGhzdGVwLCB0d2VlblByb3AgfSBmcm9tIFwiLi4vY29yZS90d2VlblwiO1xuaW1wb3J0IHsgR2FtZSB9IGZyb20gXCIuLi9nYW1lXCI7XG5pbXBvcnQgeyBwbGF5U291bmQsIFNvdW5kIH0gZnJvbSBcIi4uL3NvdW5kc1wiO1xuaW1wb3J0IHsgU2NyZWVuTmFtZSwgVXBkYXRlU2NyZWVuIH0gZnJvbSBcIi4vc2NyZWVuXCI7XG5cbmNvbnN0IGVudW0gTWVudUl0ZW0ge1xuICBTdGFydCxcbiAgU2NvcmVcbn1cblxuY29uc3QgY3JlYXRlU3RhcnRTY3JlZW4gPSAoZ2FtZTogR2FtZSk6IFVwZGF0ZVNjcmVlbiA9PiB7XG4gIGNvbnN0IHsgc3RhZ2UgfSA9IGdhbWU7XG4gIGNvbnN0IHRpbGVTaXplID0gQVNTRVRTX1NDQUxFRF9USUxFX1NJWkU7XG4gIGNvbnN0IHRleHRTaXplID0gQVNTRVRTX1NDQUxFRF9JVEVNX1NJWkU7XG4gIGNvbnN0IHRpdGxlTGluZTEgPSBjcmVhdGVUZXh0KFwiRU5DSEFOVEVEXCIsIHRpbGVTaXplICogMiwgeyB5OiB0aWxlU2l6ZSAqIDIsIGNvbG9yOiBDb2xvci5CZWlnZSB9KTtcbiAgY29uc3QgdGl0bGVMaW5lMiA9IGNyZWF0ZVRleHQoXCJEVU5HRU9OXCIsIHRpbGVTaXplICogMiwgeyB5OiB0aWxlU2l6ZSAqIDUsIGNvbG9yOiBDb2xvci5CZWlnZSB9KTtcbiAgY29uc3Qgc3RhcnQgPSBjcmVhdGVUZXh0KFwiU1RBUlRcIiwgdGV4dFNpemUsIHsgeTogc3RhZ2UuaGVpZ2h0IC0gdGlsZVNpemUgKiA0IH0pO1xuICBjb25zdCBzY29yZSA9IGNyZWF0ZVRleHQoXCJTQ09SRVNcIiwgdGV4dFNpemUsIHsgeTogc3RhZ2UuaGVpZ2h0IC0gdGlsZVNpemUgKiAzICsgNSB9KTtcbiAgY29uc3Qgc2N1bGwgPSBjcmVhdGVDb2xvcmVkU3ByaXRlKFRpbGUuU2N1bGwsIENvbG9yLlJlZCwgeyB5OiBzdGFydC55IH0pO1xuICBjb25zdCBibGFuayA9IGNyZWF0ZVJlY3RTaGFwZShzdGFnZS53aWR0aCwgc3RhZ2UuaGVpZ2h0LCB7IGNvbG9yOiBDb2xvci5Ccm93bkRhcmsgfSk7XG4gIGNvbnN0IG1lbnUgPSBbc3RhcnQueSwgc2NvcmUueV07XG4gIGNvbnN0IGtleVVwSGFuZGxlciA9IChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgIGNvbnN0IHsga2V5Q29kZSB9ID0gZXZlbnQ7XG4gICAgaWYgKGtleUNvZGUgPT09IEtFWV9VUCB8fCBrZXlDb2RlID09PSBLRVlfRE9XTiB8fCBrZXlDb2RlID09PSBLRVlfTEVGVCB8fCBrZXlDb2RlID09PSBLRVlfUklHSFQpIHtcbiAgICAgIHNlbGVjdGlvbiA9IChzZWxlY3Rpb24gKyAxKSAlIG1lbnUubGVuZ3RoO1xuICAgICAgcGxheVNvdW5kKFNvdW5kLk9wdGlvbik7XG4gICAgfSBlbHNlIGlmIChrZXlDb2RlID09PSBTUEFDRSB8fCBrZXlDb2RlID09PSBFTlRFUikge1xuICAgICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIGtleVVwSGFuZGxlcik7XG4gICAgICB0d2VlblByb3AoXG4gICAgICAgIDMwLFxuICAgICAgICAoYmxhbmsuYWxwaGEgPSAwKSxcbiAgICAgICAgMSxcbiAgICAgICAgc21vb3Roc3RlcCxcbiAgICAgICAgKHgpID0+IChibGFuay5hbHBoYSA9IHgpLFxuICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgc3RhZ2UucmVtb3ZlQWxsKCk7XG4gICAgICAgICAgaWYgKHNlbGVjdGlvbiA9PT0gTWVudUl0ZW0uU3RhcnQpIGdhbWUuY2hhbmdlU2NyZWVuKFNjcmVlbk5hbWUuR2FtZSk7XG4gICAgICAgICAgZWxzZSBnYW1lLmNoYW5nZVNjcmVlbihTY3JlZW5OYW1lLkhpZ2hTY29yZXMpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbiAgfTtcblxuICBsZXQgc2VsZWN0aW9uID0gMDtcblxuICBzdGFnZS5hZGRNYW55KHRpdGxlTGluZTEsIHRpdGxlTGluZTIsIHN0YXJ0LCBzY29yZSwgc2N1bGwsIGJsYW5rKTtcbiAgLy8gRmFkZSBvdXRcbiAgdHdlZW5Qcm9wKFxuICAgIDMwLFxuICAgIDEsXG4gICAgMCxcbiAgICBzbW9vdGhzdGVwLFxuICAgIChhKSA9PiAoYmxhbmsuYWxwaGEgPSBhKSxcbiAgICAoKSA9PiAoYmxhbmsuYWxwaGEgPSAwKVxuICApO1xuXG4gIGFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCBrZXlVcEhhbmRsZXIpO1xuXG4gIHJldHVybiAoKSA9PiB7XG4gICAgdGl0bGVMaW5lMS54ID0gKHN0YWdlLndpZHRoIC0gdGl0bGVMaW5lMS53aWR0aCkgLyAyO1xuICAgIHRpdGxlTGluZTIueCA9IChzdGFnZS53aWR0aCAtIHRpdGxlTGluZTIud2lkdGgpIC8gMjtcbiAgICBzdGFydC54ID0gc2NvcmUueCA9IChzdGFnZS53aWR0aCAtIHN0YXJ0LndpZHRoKSAvIDI7XG5cbiAgICBzY3VsbC54ID0gc3RhcnQueCAtIHNjdWxsLndpZHRoIC0gMTA7XG4gICAgc2N1bGwueSA9IG1lbnVbc2VsZWN0aW9uXTtcbiAgfTtcbn07XG5cbmV4cG9ydCB7IGNyZWF0ZVN0YXJ0U2NyZWVuIH07XG4iLCJpbXBvcnQgeyBBU1NFVFNfU0NBTEVEX1RJTEVfU0laRSB9IGZyb20gXCIuL2Fzc2V0c1wiO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tIFwiLi9jb2xvcnNcIjtcbmltcG9ydCB7IGNyZWF0ZVN0YWdlLCBTdGFnZSB9IGZyb20gXCIuL2NvcmUvc3RhZ2VcIjtcbmltcG9ydCB7IHVwZGF0ZVR3ZWVucyB9IGZyb20gXCIuL2NvcmUvdHdlZW5cIjtcbmltcG9ydCB7IGNyZWF0ZUdhbWVTY3JlZW4gfSBmcm9tIFwiLi9zY3JlZW5zL2dhbWUtc2NyZWVuXCI7XG5pbXBvcnQgeyBjcmVhdGVIaWdoU2NvcmVzU2NyZWVuIH0gZnJvbSBcIi4vc2NyZWVucy9zY29yZS1zY3JlZW5cIjtcbmltcG9ydCB7IFNjcmVlbk5hbWUsIFVwZGF0ZVNjcmVlbiB9IGZyb20gXCIuL3NjcmVlbnMvc2NyZWVuXCI7XG5pbXBvcnQgeyBjcmVhdGVTdGFydFNjcmVlbiB9IGZyb20gXCIuL3NjcmVlbnMvc3RhcnQtc2NyZWVuXCI7XG5cbmludGVyZmFjZSBHYW1lIHtcbiAgcmVhZG9ubHkgc3RhZ2U6IFN0YWdlO1xuICB1cGRhdGUoZHQ6IG51bWJlcik6IHZvaWQ7XG4gIHJlbmRlcigpOiB2b2lkO1xuICBjaGFuZ2VTY3JlZW4obmFtZTogU2NyZWVuTmFtZSwgLi4uYXJnczogYW55W10pOiB2b2lkO1xufVxuXG5jb25zdCBjcmVhdGVHYW1lID0gKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpOiBHYW1lID0+IHtcbiAgbGV0IHVwZGF0ZVNjcmVlbjogVXBkYXRlU2NyZWVuO1xuXG4gIGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcbiAgY29uc3QgdGlsZVNpemUgPSBBU1NFVFNfU0NBTEVEX1RJTEVfU0laRTtcbiAgY29uc3Qgc3RhZ2UgPSBjcmVhdGVTdGFnZShjYW52YXMud2lkdGggKyB0aWxlU2l6ZSwgY2FudmFzLmhlaWdodCwgeyB4OiAtdGlsZVNpemUgLyAyIH0pO1xuXG4gIGNvbnN0IGdhbWUgPSB7XG4gICAgc3RhZ2UsXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcbiAgICAgIHN0YWdlLnVwZGF0ZShkdCk7XG5cbiAgICAgIHVwZGF0ZVNjcmVlbihkdCk7XG4gICAgICB1cGRhdGVUd2VlbnMoZHQpO1xuICAgIH0sXG4gICAgcmVuZGVyKCkge1xuICAgICAgY29udGV4dC5maWxsU3R5bGUgPSBDb2xvci5Ccm93bkRhcms7XG4gICAgICBjb250ZXh0LmZpbGxSZWN0KDAsIDAsIHN0YWdlLndpZHRoLCBzdGFnZS5oZWlnaHQpO1xuXG4gICAgICBzdGFnZS5yZW5kZXIoY29udGV4dCk7XG4gICAgfSxcbiAgICBjaGFuZ2VTY3JlZW4obmFtZTogU2NyZWVuTmFtZSwgLi4ucGFyYW1zOiBhbnlbXSkge1xuICAgICAgbGV0IHNjb3JlOiBudW1iZXIsIGNvbG9yOiBzdHJpbmc7XG4gICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgY2FzZSBTY3JlZW5OYW1lLlN0YXJ0OlxuICAgICAgICAgIHVwZGF0ZVNjcmVlbiA9IGNyZWF0ZVN0YXJ0U2NyZWVuKGdhbWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFNjcmVlbk5hbWUuR2FtZTpcbiAgICAgICAgICB1cGRhdGVTY3JlZW4gPSBjcmVhdGVHYW1lU2NyZWVuKGdhbWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFNjcmVlbk5hbWUuSGlnaFNjb3JlczpcbiAgICAgICAgICBzY29yZSA9IHBhcmFtc1swXSA/PyAtMTtcbiAgICAgICAgICBjb2xvciA9IHBhcmFtc1sxXSA/PyBDb2xvci5XaGl0ZTtcbiAgICAgICAgICB1cGRhdGVTY3JlZW4gPSBjcmVhdGVIaWdoU2NvcmVzU2NyZWVuKGdhbWUsIHNjb3JlLCBjb2xvcik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBnYW1lLmNoYW5nZVNjcmVlbihTY3JlZW5OYW1lLlN0YXJ0KTtcbiAgcmV0dXJuIGdhbWU7XG59O1xuXG5leHBvcnQgeyBHYW1lLCBjcmVhdGVHYW1lIH07XG4iLCJpbXBvcnQgeyBpbml0QXNzZXRzIH0gZnJvbSBcIi4vYXNzZXRzXCI7XG5pbXBvcnQgQVRMQVNfVVJMIGZyb20gXCIuL2Fzc2V0cy9hLnBuZ1wiO1xuaW1wb3J0IERFQVRIX0RST1AgZnJvbSBcIi4vYXNzZXRzL2RlYXRoLWRyb3BcIjtcbmltcG9ydCB7IGluaXRSZW5kZXJlciB9IGZyb20gXCIuL2NvcmUvcmVuZGVyZXJcIjtcbmltcG9ydCB7IGNyZWF0ZUdhbWUgfSBmcm9tIFwiLi9nYW1lXCI7XG5pbXBvcnQgeyBsb2FkUmVjb3JkcyB9IGZyb20gXCIuL3NjcmVlbnMvc2NvcmUtc2NyZWVuXCI7XG5pbXBvcnQgeyBwbGF5TXVzaWMgfSBmcm9tIFwiLi9zb3VuZHNcIjtcbmltcG9ydCB7IGxvYWRJbWFnZSB9IGZyb20gXCIuL3V0aWxzXCI7XG5cbmNvbnN0IG1haW4gPSBhc3luYyAoKSA9PiB7XG4gIGluaXRBc3NldHMoYXdhaXQgbG9hZEltYWdlKEFUTEFTX1VSTCkpO1xuXG4gIGxvYWRSZWNvcmRzKCk7XG4gIHBsYXlNdXNpYyhERUFUSF9EUk9QKTtcblxuICBsZXQgbm93OiBudW1iZXI7XG4gIGxldCBkdDogbnVtYmVyO1xuICBsZXQgbGFzdCA9IDA7XG4gIGxldCBmb2N1c2VkID0gdHJ1ZTtcblxuICBvbmZvY3VzID0gKCkgPT4gKGZvY3VzZWQgPSB0cnVlKTtcbiAgb25ibHVyID0gKCkgPT4gKGZvY3VzZWQgPSBmYWxzZSk7XG5cbiAgY29uc3QgZ2FtZSA9IGNyZWF0ZUdhbWUoZyk7XG4gIGNvbnN0IHJlbmRlciA9IGluaXRSZW5kZXJlcihnKTtcbiAgY29uc3QgbG9vcCA9ICh0OiBudW1iZXIpID0+IHtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUobG9vcCk7XG5cbiAgICBpZiAoIWZvY3VzZWQpIHJldHVybjtcblxuICAgIG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIGR0ID0gbm93IC0gbGFzdDtcbiAgICBsYXN0ID0gbm93O1xuXG4gICAgZ2FtZS51cGRhdGUoZHQpO1xuICAgIGdhbWUucmVuZGVyKCk7XG5cbiAgICByZW5kZXIodCk7XG4gIH07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QyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxHQUFHLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsbUVBQW1FLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLG9FQUFvRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsMEJBQTBCLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsMkJBQTJCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsMEJBQTBCLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsMEJBQTBCLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLDBCQUEwQixFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSwwQkFBMEIsRUFBRSxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsc0NBQXNDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsNEJBQTRCLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsMkJBQTJCLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLGlDQUFpQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUscUJBQXFCLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLGlDQUFpQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSwwQkFBMEIsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLG9CQUFvQixFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsMkRBQTJELENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxzQ0FBc0MsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxjQUFjLEVBQUUsRUFBRSxFQUFFLGNBQWMsRUFBRSxFQUFFLEVBQUUsK0JBQStCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxpQ0FBaUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxpQ0FBaUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsd0JBQXdCLEVBQUUsUUFBUSxDQUFDLGlDQUFpQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsd0JBQXdCLEVBQUUsUUFBUSxFQUFFLGlDQUFpQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSx3QkFBd0IsRUFBRSxRQUFRLEVBQUUsaUNBQWlDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSx3QkFBd0IsRUFBRSxRQUFRLEVBQUUsaUNBQWlDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxpQ0FBaUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxpQ0FBaUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLHNDQUFzQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsY0FBYyxFQUFFLEVBQUUsRUFBRSxjQUFjLEVBQUUsRUFBRSxFQUFFLCtCQUErQixDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEVBQUUs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Q0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNO0lBQzdCLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsQ0FBQzs7QUN4RC9CLE1BQU0sSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLEVBQUUsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDdk0sRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzcxQixFQUFFLEtBQUssQ0FBQyxFQUFFO0FBQ1YsRUFBRSxLQUFLLENBQUMsS0FBSztBQUNiLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLFlBQVksRUFBRSxrQkFBa0IsQ0FBQztBQUNwRCxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBSSxJQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENB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R0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsSUFBSTtBQUNOLEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsT0FBTztBQUNULEVBQUUsR0FBRztBQUNMLEVBQUUsUUFBUTtBQUNWLEVBQUUsT0FBTztBQUNULEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsSUFBSTtBQUNOLEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsR0FBRztBQUNMLEVBQUUsUUFBUTtBQUNWLEVBQUUsUUFBUTtBQUNWLEVBQUUsUUFBUTtBQUNWLEVBQUUsR0FBRztBQUNMLEVBQUUsUUFBUTtBQUNWO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRSxHQUFHO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7QUNyREQsTUFBTSxTQUFTLEdBQWtCLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUVoRCxNQUFNLFVBQVUsR0FBRyxDQUFDLEtBQWEsRUFBRSxJQUFZLEVBQUUsS0FBaUIsS0FBVTtBQUMxRSxJQUFBLE1BQU0sSUFBSSxHQUFTLE1BQU0sQ0FBQyxNQUFNLENBQzlCLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLEtBQUk7UUFDdEMsSUFBSSxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN2RSxLQUFDLENBQUMsRUFDRjtBQUNFLFFBQUEsS0FBSyxFQUFFLE1BQU07UUFDYixLQUFLO1FBQ0wsSUFBSTtLQUNMLEVBQ0QsS0FBSyxDQUNOLENBQUM7QUFDRixJQUFBLElBQUksS0FBSztRQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUN2QixJQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQzs7QUMvQkQsTUFBTSxzQkFBc0IsR0FBRyxDQUFDLEtBQXVCLE1BQ3JELE1BQUEsQ0FBQSxNQUFBLENBQUEsRUFBQSxFQUFFLEVBQUUsQ0FBQyxFQUNMLEVBQUUsRUFBRSxDQUFDLEVBQ0wsSUFBSSxFQUFFLENBQUMsRUFDUCxJQUFJLEVBQUUsQ0FBQyxFQUFBLEVBQ0osS0FBSyxDQUFBLENBQ1I7O0FDRUYsTUFBTSxlQUFlLEdBQUcsQ0FBQyxLQUFrQixFQUFFLEtBQVksRUFBRSxTQUFTLEdBQUcsS0FBSyxFQUFFLEtBQXNCLEtBQWU7SUFDakgsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQ2QsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBRWpCLElBQUEsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUMvQixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUV2RSxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkMsSUFBQSxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO0FBQzlCLElBQUEsTUFBTSxLQUFLLEdBQWMsTUFBTSxDQUFDLE1BQU0sQ0FDcEMsTUFBTSxFQUNOO0FBQ0UsUUFBQSxXQUFXLEVBQUUsQ0FBQztBQUNkLFFBQUEsWUFBWSxFQUFpQixTQUFBO0FBQzdCLFFBQUEsU0FBUyxFQUFFLENBQUM7UUFDWixNQUFNO1FBQ04sS0FBSztRQUNMLElBQUksR0FBQTtZQUNGLFNBQVMsR0FBRyxJQUFJLENBQUM7U0FDbEI7UUFDRCxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBQTtZQUNaLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDbEIsWUFBQSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsUUFBUSxHQUFHLEtBQUssRUFBRSxDQUFDLENBQUM7U0FDbEQ7UUFDRCxJQUFJLEdBQUE7QUFDRixZQUFBLE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUM7WUFDOUIsSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFO0FBQ1gsZ0JBQUEsS0FBSyxDQUFDLFVBQVUsSUFBSSxHQUFHLENBQUM7Z0JBQ3hCLEtBQUssQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUssY0FBYyxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUN2RyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQyxhQUFBO0FBQU0saUJBQUE7QUFDTCxnQkFBQSxTQUFTLEVBQUUsQ0FBQztBQUNiLGFBQUE7U0FDRjtBQUNELFFBQUEsTUFBTSxDQUFDLEVBQVUsRUFBQTtBQUNmLFlBQUEsSUFBSSxDQUFDLFNBQVM7Z0JBQUUsT0FBTztBQUV2QixZQUFBLEtBQUssRUFBRSxDQUFDO0FBQ1IsWUFBQSxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUMsU0FBUyxLQUFLLENBQUMsRUFBRTtnQkFDakMsUUFBUSxHQUFHLENBQUMsUUFBUSxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUM7Z0JBQ3RDLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ3hDLGFBQUE7U0FDRjtRQUNELE9BQU8sR0FBQTtBQUNMLFlBQUEsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQzlCLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUcsQ0FBQyxDQUFDO0FBQ3RDLGFBQUE7U0FDRjtLQUNGLEVBQ0QsS0FBSyxDQUNOLENBQUM7QUFDRixJQUFBLElBQUksS0FBSztRQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUV4QixJQUFBLE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQzs7QUMzREQsTUFBTSxXQUFXLEdBQUcsQ0FBQyxJQUFVLEVBQUUsS0FBWSxFQUFFLEtBQWtCLEtBQVc7QUFDMUUsSUFBQSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRSxzQkFBc0IsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQy9GLElBQUEsSUFBSSxLQUFLO1FBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3hCLElBQUEsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDLENBQUM7QUFRSyxNQUFNLFdBQVcsR0FBRyxNQUFZO0lBRXJDLE1BQU0sS0FBSyxHQUFVLE1BQU0sQ0FBQyxNQUFNLENBQ2hDLG1CQUFtQixrREFBeUIsRUFDNUM7QUFDRSxRQUFBLE1BQU0sQ0FBQyxFQUFVLEVBQUE7WUFDZixJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU07Z0JBQUUsT0FBTztBQUcxQixZQUFBLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7O1NBRXBEO0tBQ0YsRUFDRDtBQUNFLFFBQUEsTUFBTSxFQUFFLEdBQUc7QUFDWCxRQUFBLE1BQU0sRUFBRSxDQUFDO0FBQ1QsUUFBQSxVQUFVLEVBQUUsa0JBQWtCO0FBQy9CLEtBQUEsQ0FDRixDQUFDO0lBQ0YsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO0FBRWIsSUFBQSxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMsQ0FBQztBQU1LLE1BQU0sV0FBVyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUE0QixLQUFXO0lBQ3ZFLE1BQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQywyQ0FBeUIsRUFBbUIsU0FBQSx3QkFBQSxJQUFJLENBQUMsQ0FBQztBQUMvRSxJQUFBLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDaEMsTUFBTSxLQUFLLEdBQVUsTUFBTSxDQUFDLE1BQU0sQ0FDaEMsSUFBSSxFQUNKLHNCQUFzQixFQUFFLEVBQ3hCO0FBQ0UsUUFBQSxNQUFNLENBQUMsRUFBVSxFQUFBOztZQUdmLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUVoQixJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU07Z0JBQUUsT0FBTztBQUUxQixZQUFBLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUM5QyxZQUFBLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUM5QyxZQUFBLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDcEQ7S0FDRixFQUNELEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLGtCQUFrQixFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixFQUFFLENBQ3BILENBQUM7SUFDRixLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7QUFFYixJQUFBLE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQzs7QUM1RUQsTUFBTSxTQUFTLEdBQUcsQ0FBQyxHQUFXLEtBQzVCLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSTtBQUM5QixJQUFBLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7QUFDMUIsSUFBQSxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztJQUNoQixLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3BDLElBQUEsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7QUFDekIsQ0FBQyxDQUFDLENBQUM7QUFFTCxNQUFNLElBQUksR0FBRyxDQUFDLFFBQVEsR0FBRyxDQUFDLEtBQ3hCLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxLQUFJO0FBQ3RCLElBQUEsVUFBVSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQztBQUVMLE1BQU0sT0FBTyxHQUFHLENBQUksS0FBZSxLQUFVO0FBQzNDLElBQUEsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3pDLFFBQUEsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDN0MsS0FBQTtBQUNILENBQUMsQ0FBQztBQUVGLE1BQU0sUUFBUSxHQUFHLENBQUMsS0FBYSxFQUFFLEtBQWEsS0FBSyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUV0RixNQUFNLGdCQUFnQixHQUFHLENBQUksR0FBYSxLQUFRLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBSXhGO0FBQ0EsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFTLEVBQUUsRUFBVSxFQUFFLEVBQVUsRUFBRSxFQUFVLEVBQUUsRUFBVSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQzs7QUNqQnBILE1BQU0sU0FBUyxHQUFHLENBQUMsS0FBYSxLQUFTO0lBQ3ZDLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztBQUNmLElBQUEsSUFBSSxVQUFrQixDQUFDO0FBQ3ZCLElBQUEsSUFBSSxFQUFVLENBQUM7SUFFZixNQUFNLE1BQU0sR0FBRyx1QkFBdUIsQ0FBQztJQUN2QyxNQUFNLFVBQVUsR0FBRyx1QkFBdUIsQ0FBQztJQUMzQyxNQUFNLE1BQU0sR0FBRyxDQUFDLE1BQU0sR0FBRyxVQUFVLElBQUksQ0FBQyxDQUFDO0FBQ3pDLElBQUEsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFBLENBQUEsb0JBQWMsQ0FBQztJQUN0QyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUM7QUFFckIsSUFBQSxNQUFNLEdBQUcsR0FBUSxNQUFNLENBQUMsTUFBTSxDQUM1QixtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsT0FBaUMsS0FBSTtBQUN2RSxRQUFBLFNBQVMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxHQUFHLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN4RSxRQUFBLEVBQUUsR0FBRyxLQUFLLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUN4QixRQUFBLEVBQUUsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNwRSxRQUFBLE9BQU8sQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLEVBQUUsR0FBRyxNQUFNLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3ZELEtBQUMsQ0FBQyxFQUNGO0FBQ0UsUUFBQSxTQUFTLENBQUMsS0FBYSxFQUFBO1lBQ3JCLE1BQU0sR0FBRyxLQUFLLENBQUM7U0FDaEI7QUFDRCxRQUFBLGFBQWEsQ0FBQyxLQUFhLEVBQUE7QUFDekIsWUFBQSxVQUFVLEdBQUcsUUFBUSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUNqQztBQUNGLEtBQUEsQ0FDRixDQUFDO0FBQ0YsSUFBQSxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JCLElBQUEsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDOztBQ3ZDRDtBQUNBLFVBQWU7QUFDZixFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQztBQUNyRCxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQzNELEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDO0FBQ3pELEVBQUUsRUFBRTtBQUNKLENBQUMsQ0FBQztBQUNGO0FBQ0E7QUFDQTtBQUNBOztBQ0NBLE1BQU0sU0FBUyxHQUFHLENBQUMsS0FBWSxLQUFLLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBRXhELE1BQU0sU0FBUyxHQUFHLE9BQU8sTUFBVyxLQUFJO0FBQ3RDLElBQUEsTUFBTSxNQUFNLEdBQUcsTUFBTSxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQ3JDLElBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztBQUMxQixJQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ2pCLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUNqQixDQUFDLENBQUM7QUFFRixNQUFNLFVBQVUsR0FBRyxPQUFPLElBQVMsS0FBc0I7QUFDdkQsSUFBQSxNQUFNLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNmLElBQUEsT0FBTyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUN4QixDQUFDOztBQ01ELE1BQU0sWUFBWSxHQUFHLENBQUMsS0FBa0IsRUFBRSxTQUFlLEVBQUUsS0FBWSxFQUFFLEtBQWtCLEtBQVk7QUFDckcsSUFBQSxJQUFJLEtBQW9DLENBQUM7SUFDekMsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDO0lBRW5CLE1BQU0sV0FBVyxHQUFHLGVBQWUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3hELElBQUEsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLEdBQUcsV0FBVyxDQUFDO0lBRXBGLE1BQU0sTUFBTSxHQUFXLE1BQU0sQ0FBQyxNQUFNLENBQ2xDLFdBQVcsRUFDWCxzQkFBc0IsRUFBRSxFQUN4QjtBQUNFLFFBQUEsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDZCxTQUFTO1FBQ1QsT0FBTyxHQUFBO1lBQ0wsT0FBTyxDQUFDLE1BQU0sQ0FBQztTQUNoQjtRQUNELEdBQUcsR0FBQTtBQUNELFlBQUEsU0FBUyxtQkFBVyxDQUFDO1lBRXJCLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFFZCxLQUFLLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNoRCxLQUFLLEdBQUcsY0FBYyxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsbUJBQW1CLEVBQUEsU0FBQSx1QkFBa0IsQ0FBQztBQUVoRixZQUFBLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7QUFFdkIsWUFBQSxNQUFNLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7U0FDOUM7QUFDRCxRQUFBLE1BQU0sQ0FBQyxFQUFVLEVBQUE7WUFDZixJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ1gsZ0JBQUEsSUFBSSxNQUFNLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRTtvQkFDbEQsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ2YsaUJBQUE7QUFBTSxxQkFBQTtvQkFDTCxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDZixpQkFBQTtnQkFDRCxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMxRCxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDakIsYUFBQTtTQUNGO0FBQ0QsUUFBQSxJQUFJLENBQUMsS0FBYyxFQUFBO0FBQ2pCLFlBQUEsSUFBSSxDQUFDLE1BQU07Z0JBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQy9CO1FBQ0QsT0FBTyxHQUFBO0FBQ0wsWUFBQSxJQUFJLEtBQUs7QUFBRSxnQkFBQSxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2xDLFlBQUEsWUFBWSxFQUFFLENBQUM7U0FDaEI7S0FDRixFQUNELEtBQUssQ0FDTixDQUFDO0lBQ0YsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO0FBRWQsSUFBQSxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDOztBQzVDRCxNQUFNLFNBQVMsR0FBRyxDQUFDLEdBQVcsRUFBRSxHQUFXLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUN4RyxNQUFNLGFBQWEsR0FBRyxNQUFNLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2xELE1BQU0sV0FBVyxHQUFHLENBQUMsSUFBc0IsS0FBSyxDQUFBLElBQUksS0FBQSxJQUFBLElBQUosSUFBSSxLQUFKLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLElBQUksQ0FBRSxPQUFPLDhCQUFxQjtBQUVsRjtBQUNBLE1BQU0sWUFBWSxHQUFHLENBQUMsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxTQUFTLEdBQUcsQ0FBQyxFQUFTLEtBQVU7SUFDM0YsTUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0lBQ3BCLE1BQU0sR0FBRyxHQUFnQixFQUFFLENBQUM7SUFDNUIsTUFBTSxhQUFhLEdBQWdCLEVBQUUsQ0FBQztJQUN0QyxNQUFNLG9CQUFvQixHQUFnQixFQUFFLENBQUM7SUFDN0MsTUFBTSxpQkFBaUIsR0FBZ0IsRUFBRSxDQUFDO0FBQzFDLElBQUEsTUFBTSxRQUFRLEdBQUcsYUFBYSxHQUFHLFlBQVksQ0FBQztBQUM5QyxJQUFBLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBUyxFQUFFLENBQVMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFlBQVksQ0FBQztBQUNoRSxJQUFBLE1BQU0sU0FBUyxHQUFHLENBQUMsRUFBVSxFQUFFLEVBQVUsS0FBSyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BFLElBQUEsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFPLEVBQUUsRUFBVSxFQUFFLEVBQVUsS0FBdUIsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDN0csSUFBQSxNQUFNLFNBQVMsR0FBRyxDQUFDLElBQWMsRUFBRSxTQUFzQixLQUFVO0FBQ2pFLFFBQUEsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxFQUNsRCxHQUFHLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUMxQixZQUFZLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUUsRUFDdkMsYUFBYSxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBRSxDQUFDO0FBQzFDLFFBQUEsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDL0IsUUFBQSxJQUFJLFlBQVksQ0FBQyxJQUFJLElBQUksYUFBYSxDQUFDLElBQUksRUFBRTtBQUMzQyxZQUFBLE9BQU8sU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztBQUNuQyxTQUFBO0FBQ0QsUUFBQSxHQUFHLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUNoQixRQUFBLE9BQU8sR0FBRyxDQUFDO0FBQ2IsS0FBQyxDQUFDO0lBQ0YsTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUFzQixLQUN0QyxDQUFBLElBQUksS0FBSixJQUFBLElBQUEsSUFBSSxLQUFKLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLElBQUksQ0FBRSxJQUFJLE1BQUssSUFBSSxDQUFDLElBQUksS0FBQSxDQUFBLHlCQUF1QixJQUFJLENBQUMsSUFBSSxLQUFpQixDQUFBLG9CQUFDLENBQUM7QUFDN0UsSUFBQSxNQUFNLFVBQVUsR0FBRyxDQUFDLElBQWMsRUFBRSxTQUFzQixLQUFzQjtBQUM5RSxRQUFBLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDO0FBQUUsWUFBQSxPQUFPLFNBQVMsQ0FBQztBQUM3QyxRQUFBLE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFDbEQsR0FBRyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUM3QixRQUFBLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQy9CLElBQ0UsUUFBUSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDakMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLFFBQVEsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pDLFFBQVEsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUNoQztBQUNBLFlBQUEsT0FBTyxVQUFVLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ3BDLFNBQUE7QUFDRCxRQUFBLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ2hCLFFBQUEsT0FBTyxHQUFHLENBQUM7QUFDYixLQUFDLENBQUM7SUFDRixNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7QUFDekIsSUFBQSxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqRSxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQyxDQUFDO0FBQzdELElBQUEsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDO0FBQzlFLElBQUEsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzlFLE1BQU0sU0FBUyxHQUFnQixFQUFFLENBQUM7QUFFbEMsSUFBQSxJQUFJLENBQVMsQ0FBQztBQUNkLElBQUEsSUFBSSxJQUFVLENBQUM7SUFDZixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7SUFDakIsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0lBQ25CLElBQUksS0FBSyxHQUFnQixFQUFFLENBQUM7SUFFNUIsSUFBSSxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ2hCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzdCLFlBQUEsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFlBQVksQ0FBQztZQUMzQixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxZQUFZLElBQUksQ0FBQyxDQUFDO1lBQ2pDLEdBQUcsQ0FBQyxJQUFJLENBQUM7Z0JBQ1AsQ0FBQztnQkFDRCxDQUFDO0FBQ0QsZ0JBQUEsT0FBTyxFQUFFLENBQUMsS0FBSyxhQUFhLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUUsQ0FBQSw0QkFBcUMsQ0FBQTtBQUNuRixhQUFBLENBQUMsQ0FBQztBQUNKLFNBQUE7QUFFRCxRQUFBO0FBQ0UsWUFBQSxDQUFDLENBQUMsRUFBRSxhQUFhLEdBQUcsQ0FBQyxFQUFrQixDQUFBLHVCQUFBO0FBQ3ZDLFlBQUEsQ0FBQyxDQUFDLEVBQUUsYUFBYSxHQUFHLENBQUMsRUFBb0IsQ0FBQSx5QkFBQTtBQUN6QyxZQUFBLENBQUMsQ0FBQyxFQUFFLGFBQWEsR0FBRyxDQUFDLEVBQW9CLENBQUEseUJBQUE7QUFDekMsWUFBQSxDQUFDLENBQUMsRUFBRSxhQUFhLEdBQUcsQ0FBQyxFQUFvQixDQUFBLHlCQUFBO0FBQ3pDLFlBQUEsQ0FBQyxDQUFDLEVBQUUsYUFBYSxHQUFHLENBQUMsRUFBb0IsQ0FBQSx5QkFBQTtBQUN6QyxZQUFBLENBQUMsWUFBWSxHQUFHLENBQUMsRUFBRSxhQUFhLEdBQUcsQ0FBQyxFQUFnQixDQUFBLHFCQUFBO1NBQ3JELENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDbkUsUUFBQTtBQUNFLFlBQUEsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxFQUFFLGFBQWEsR0FBRyxDQUFDLEVBQW9CLENBQUEseUJBQUE7QUFDeEQsWUFBQSxDQUFDLFlBQVksR0FBRyxDQUFDLEVBQUUsYUFBYSxHQUFHLENBQUMsRUFBb0IsQ0FBQSx5QkFBQTtBQUN4RCxZQUFBLENBQUMsWUFBWSxHQUFHLENBQUMsRUFBRSxhQUFhLEdBQUcsQ0FBQyxFQUFvQixDQUFBLHlCQUFBO0FBQ3hELFlBQUEsQ0FBQyxDQUFDLEVBQUUsYUFBYSxHQUFHLENBQUMsRUFBbUIsQ0FBQSx3QkFBQTtBQUN4QyxZQUFBLENBQUMsRUFBRSxFQUFFLGFBQWEsR0FBRyxDQUFDLEVBQW1CLENBQUEsd0JBQUE7U0FDMUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsV0FBVyxDQUFDLE1BQU0sU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUU1RSxPQUFPO1lBQ0wsR0FBRztZQUNILGFBQWE7U0FDZCxDQUFDO0FBQ0gsS0FBQTs7SUFHRCxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUM3QixHQUFHLENBQUMsSUFBSSxDQUFDO1lBQ1AsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZO0FBQ25CLFlBQUEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLFlBQVksSUFBSSxDQUFDO0FBQ3pCLFlBQUEsT0FBTyxFQUFFLGFBQWEsRUFBRSxHQUFFLENBQUEsMEJBQW1DLENBQUE7QUFDOUQsU0FBQSxDQUFDLENBQUM7QUFDSixLQUFBOztBQUdELElBQUEsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSTs7UUFDaEIsTUFBTSxZQUFZLEdBQUcsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUzQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssWUFBWSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLGFBQWEsR0FBRyxDQUFDLEVBQUU7QUFDbkYsWUFBQSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssYUFBYSxHQUFHLENBQUMsRUFBRTtnQkFDN0IsQ0FBQyxDQUFDLE9BQU8sR0FBQSxDQUFBLDBCQUFzQjtBQUMvQixnQkFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2YsYUFBQTs7Z0JBQU0sQ0FBQyxDQUFDLE9BQU8sR0FBQSxDQUFBLHVCQUFtQjtBQUNwQyxTQUFBO0FBQU0sYUFBQTtBQUNMLFlBQUEsSUFBSSxDQUFDLENBQUMsT0FBTyxLQUFBLENBQUEseUJBQXVCO0FBQ2xDLGdCQUFBLElBQUksQ0FBQSxDQUFBLEVBQUEsR0FBQSxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLE9BQU8sK0JBQXNCO29CQUN0RCxDQUFDLENBQUMsT0FBTyxHQUFBLENBQUEseUJBQXFCO0FBQzlCLG9CQUFBLElBQUksWUFBWSxFQUFFO3dCQUNoQixJQUFJLFlBQVksQ0FBQyxPQUFPLEtBQUEsQ0FBQSwyQkFBeUIsWUFBWSxDQUFDLE9BQU8sS0FBQSxDQUFBLDBCQUF3Qjs0QkFDM0YsWUFBWSxDQUFDLE9BQU8sR0FBQSxDQUFBLHVCQUFtQjtBQUN4Qyx5QkFBQTtBQUNGLHFCQUFBO0FBQ0YsaUJBQUE7QUFDRixhQUFBO0FBQ0YsU0FBQTtBQUNILEtBQUMsQ0FBQyxDQUFDOztJQUdILEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFJO0FBQ3pCLFFBQUEsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQ3JDLFlBQUEsSUFBSSxDQUFTLENBQUM7WUFDZCxJQUFJLGVBQWUsR0FBRyxDQUFDLENBQUM7QUFDeEIsWUFBQSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGFBQWEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDdEMsZ0JBQUEsSUFBSSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdCLGdCQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0FBQUUsb0JBQUEsZUFBZSxFQUFFLENBQUM7QUFDM0MsYUFBQTtZQUNELElBQUksZUFBZSxHQUFHLENBQUM7QUFBRSxnQkFBQSxPQUFPLEtBQUssQ0FBQztBQUN2QyxTQUFBO0FBQ0QsUUFBQSxPQUFPLElBQUksQ0FBQztBQUNkLEtBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxRQUFRLEdBQUcsU0FBUyxFQUFFO1FBQy9DLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbkMsUUFBQSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hCLElBQUksQ0FBQyxPQUFPLEdBQUEsQ0FBQSx1QkFBbUI7QUFDL0IsUUFBQSxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BELFFBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7WUFBRSxTQUFTLENBQUMsT0FBTyxHQUFBLENBQUEsdUJBQW1CO1FBQ2pFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN2QixRQUFBLFFBQVEsRUFBRSxDQUFDO0FBQ1osS0FBQTtBQUVELElBQUEsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQU8sS0FBSTtRQUN0QixJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEtBQUEsQ0FBQSwwQkFBd0I7WUFDOUMsTUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUUsQ0FBQztBQUN6QyxZQUFBLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDL0IsU0FBQTtBQUNILEtBQUMsQ0FBQyxDQUFDOztJQUdILFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyx3QkFBZ0IsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUN4RCxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUM5QixTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsNEJBQW9CLGFBQWEsQ0FBQyxDQUFDLENBQUM7QUFDN0QsS0FBQTtJQUNELFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUywwQkFBa0IsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUMxRCxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsMEJBQWtCLGFBQWEsQ0FBQyxDQUFDLENBQUM7QUFFMUQsSUFBQSxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBTyxLQUFJO0FBQ3RCLFFBQUEsSUFDRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDUCxZQUFBLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxHQUFHLENBQUM7WUFDdEIsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO2FBQ04sQ0FBQyxDQUFDLE9BQU8sS0FBc0IsQ0FBQSw0QkFBSSxDQUFDLENBQUMsT0FBTyxLQUF1QixDQUFBLDBCQUFDLEVBQ3JFO1lBQ0EsSUFBSSxHQUFHLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFFLENBQUM7QUFDOUIsWUFBQSxJQUNFLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztnQkFDM0IsV0FBVyxDQUFDLElBQUksQ0FBQztpQkFDaEIsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7cUJBQzlFLFdBQVcsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUNsRjtBQUNBLGdCQUFBLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNqQyxhQUFBO0FBQ0YsU0FBQTtBQUNILEtBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxvQkFBb0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLFVBQVUsR0FBRyxrQkFBa0IsRUFBRTtRQUN6RSxVQUFVLENBQUEsQ0FBQSx1QkFBaUIsb0JBQW9CLENBQUMsQ0FBQztBQUNqRCxRQUFBLFVBQVUsRUFBRSxDQUFDO0FBQ2QsS0FBQTtBQUVELElBQUEsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSTtBQUNoQixRQUFBLElBQ0UsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQ1AsWUFBQSxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksR0FBRyxDQUFDO1lBQ3RCLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDZCxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDakMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDbEMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQ2pDO0FBQ0EsWUFBQSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0IsU0FBQTtBQUNILEtBQUMsQ0FBQyxDQUFDO0lBRUgsVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNmLE9BQU8saUJBQWlCLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxVQUFVLEdBQUcsa0JBQWtCLEVBQUU7UUFDdEUsVUFBVSxDQUFBLENBQUEscUJBQWUsaUJBQWlCLENBQUMsQ0FBQztBQUM1QyxRQUFBLFVBQVUsRUFBRSxDQUFDO0FBQ2QsS0FBQTtJQUVELE9BQU87UUFDTCxHQUFHO1FBQ0gsYUFBYTtLQUNkLENBQUM7QUFDSixDQUFDOztBQ3ZPRCxNQUFNLFlBQVksR0FBRyxDQUFDLE9BQWEsRUFBRSxNQUFZLEVBQUUsS0FBWSxFQUFFLE9BQU8sR0FBRyxDQUFDLEVBQUUsS0FBc0IsS0FBWTtJQUM5RyxJQUFJLEtBQUssMkJBQW1CO0FBQzVCLElBQUEsTUFBTSxNQUFNLEdBQVcsTUFBTSxDQUFDLE1BQU0sQ0FDbEMsZUFBZSxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsRUFDaEQ7UUFDRSxLQUFLLEdBQUE7WUFDSCxPQUFPLEtBQUssNkJBQXFCO1NBQ2xDO1FBQ0QsSUFBSSxHQUFBO1lBQ0YsT0FBTyxLQUFLLDRCQUFvQjtTQUNqQztRQUNELE1BQU0sR0FBQTtBQUNKLFlBQUEsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEtBQUssR0FBQSxDQUFBLHVCQUFtQixDQUFDLENBQUM7QUFDekQsWUFBQSxNQUFNLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQztTQUN4QjtBQUNEOzs7OztBQUtBO0tBQ0QsRUFDRCxLQUFLLENBQ04sQ0FBQztBQUNGLElBQUEsSUFBSSxLQUFLO1FBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3pCLElBQUEsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQzs7QUNMRCxNQUFNLFdBQVcsR0FBRyxDQUFDLElBQTJCLEtBQUk7QUFDbEQsSUFBQSxPQUFPLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM5QixRQUFBLElBQUksQ0FBQyxHQUFHLEVBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN2QixLQUFBO0FBQ0gsQ0FBQyxDQUFDO0FBRUYsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLElBQVUsS0FBa0I7QUFDcEQsSUFBQSxJQUFJLFNBQXdCLENBQUM7QUFDN0IsSUFBQSxJQUFJLFNBQXdCLENBQUM7QUFDN0IsSUFBQSxJQUFJLE1BQW9CLENBQUM7QUFDekIsSUFBQSxJQUFJLElBQWtCLENBQUM7QUFDdkIsSUFBQSxJQUFJLEtBQXNCLENBQUM7QUFDM0IsSUFBQSxJQUFJLElBQVksQ0FBQztBQUNqQixJQUFBLElBQUksTUFBYyxDQUFDO0FBQ25CLElBQUEsSUFBSSxNQUEwQixDQUFDO0FBQy9CLElBQUEsSUFBSSxTQUE2QixDQUFDO0FBQ2xDLElBQUEsSUFBSSxLQUF3QixDQUFDO0FBQzdCLElBQUEsSUFBSSxJQUFZLENBQUM7SUFDakIsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ2IsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2QsSUFBQSxJQUFJLFlBQVksR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN0QixJQUFJLFlBQVksR0FBRyxLQUFLLENBQUM7QUFFekIsSUFBQSxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDO0lBQ3ZCLE1BQU0sUUFBUSxHQUFHLHVCQUF1QixDQUFDO0lBQ3pDLE1BQU0sVUFBVSxHQUFHLGtCQUFrQixDQUFDO0lBQ3RDLE1BQU0sV0FBVyxHQUFHLG1CQUFtQixDQUFDO0lBQ3hDLE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDbkMsSUFBQSxNQUFNLEtBQUssR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFpQixTQUFBLHdCQUFFLENBQUMsQ0FBQztBQUNyRixJQUFBLE1BQU0sUUFBUSxHQUFHLFVBQVUsQ0FBQyxVQUFVLEVBQUUsUUFBUSxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBYSxTQUFBLG9CQUFFLENBQUMsQ0FBQztJQUM5RSxNQUFNLE1BQU0sR0FBcUIsRUFBRSxDQUFDO0lBQ3BDLE1BQU0sWUFBWSxHQUFHLENBQUEsU0FBQSxvQkFBQSxTQUFBLHlCQUFBLFNBQUEsMEJBQUEsU0FBQSxxQkFBQSxTQUFBLHFCQUFBLFNBQUEsaUJBQXlGLENBQUM7SUFDL0csTUFBTSxXQUFXLEdBQUcsQ0FBQSxFQUFBLGtCQUFBLEVBQUEsb0JBQUEsRUFBQSxtQkFBcUMsQ0FBQztJQUMxRCxNQUFNLFlBQVksR0FBRyxDQUFBLEVBQUEsbUJBQUEsRUFBQSxvQkFBQSxFQUFBLG1CQUFzQyxDQUFDO0FBRTVELElBQUEsTUFBTSxTQUFTLEdBQUcsQ0FDaEIsV0FBQSxHQUFBLFNBQUEscUJBQ0EsVUFBQSxHQUFBLEVBQUEsa0JBQ0EsZUFBQSxHQUFBLEVBQUEsbUJBQ0EsTUFBTSxHQUFHLENBQUMsS0FDUjtRQUNGLElBQUksS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUFFLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUUzQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdkIsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3ZCLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwQixXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7QUFFbEIsUUFBQSxJQUFJLFNBQVM7WUFBRSxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkMsUUFBQSxJQUFJLE1BQU07WUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDN0IsUUFBQSxJQUFJLEtBQUs7WUFBRSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDM0IsUUFBQSxJQUFJLE1BQU07WUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFN0IsU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNmLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDZixNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ1osSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNWLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDWCxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ1QsUUFBQSxTQUFTLEdBQUcsTUFBTSxHQUFHLEtBQUssR0FBRyxTQUFTLENBQUM7UUFFdkMsSUFBSSxNQUFNLElBQUksTUFBTSxFQUFFO0FBQ3BCLFlBQUEsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzdCLFlBQUEsTUFBTSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ3pCLFNBQVMsR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUU7Z0JBQzVELENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDVixDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ1YsVUFBVTtnQkFDVixXQUFXO0FBQ1osYUFBQSxDQUFDLENBQUM7QUFDSCxZQUFBLEtBQUssR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDNUIsU0FBQTtBQUFNLGFBQUE7QUFDTCxZQUFBLE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsVUFBVSxDQUFDLENBQUM7QUFDdEQsU0FBQTtBQUVELFFBQUEsWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDM0IsTUFBTSxJQUFJLEdBQUcsWUFBWSxDQUFDO0FBQ3hCLFlBQUEsWUFBWSxFQUFFLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBUTtBQUNwQyxZQUFBLGFBQWEsRUFBRSxLQUFLLENBQUMsTUFBTSxHQUFHLFFBQVE7WUFDdEMsTUFBTTtBQUNQLFNBQUEsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUk7WUFDeEIsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFvQixDQUFBO2dCQUFFLE9BQU87QUFDN0MsWUFBQSxJQUFJLE1BQWMsQ0FBQztZQUNuQixRQUFRLElBQUksQ0FBQyxPQUFPO0FBQ2xCLGdCQUFBLEtBQUEsQ0FBQTtvQkFDRSxNQUFNLEdBQUcsbUJBQW1CLENBQUEsQ0FBQSxtQkFBQSxTQUFBLHdCQUE4QixDQUFDO29CQUMzRCxNQUFNO0FBQ1IsZ0JBQUEsS0FBQSxDQUFBO29CQUNFLE1BQU0sR0FBRyxtQkFBbUIsQ0FBQSxDQUFBLG1CQUFBLFNBQUEsbUJBQXlCLENBQUM7b0JBQ3RELE1BQU07QUFDUixnQkFBQSxLQUFBLENBQUE7b0JBQ0UsTUFBTSxHQUFHLG1CQUFtQixDQUFBLENBQUEsa0JBQUEsU0FBQSxrQkFBdUIsQ0FBQztvQkFDcEQsTUFBTTtBQUNULGFBQUE7WUFDRCxNQUFNLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUM7QUFDN0IsWUFBQSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3pCLFNBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFVLEtBQUk7QUFDOUIsWUFBQSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO0FBQzNCLGdCQUFBLElBQUksS0FBYSxFQUFFLEtBQVksRUFBRSxNQUFjLENBQUM7Z0JBQ2hELFFBQVEsSUFBSSxDQUFDLElBQUk7QUFDZixvQkFBQSxLQUFBLENBQUE7d0JBQ0UsTUFBTSxHQUFHLE1BQU0sR0FBRyxZQUFZLENBQzVCLENBQUMsVUFBVSxFQUFFLFVBQVUsR0FBRyxDQUFDLEVBQUUsVUFBVSxFQUFFLFVBQVUsR0FBRyxDQUFDLENBQUMsRUFDeEQsZUFBZSxFQUNmLFdBQVcsRUFDWDs0QkFDRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ1YsNEJBQUEsTUFBTSxFQUFFLEdBQUc7QUFDWCw0QkFBQSxNQUFNLEVBQUUsR0FBRzs0QkFDWCxVQUFVO0FBQ1YsNEJBQUEsU0FBUyxFQUFFLENBQUM7QUFDWiw0QkFBQSxTQUFTLEVBQUUsQ0FBQztBQUNaLDRCQUFBLE9BQU8sRUFBRSxHQUFHOzRCQUNaLFNBQVMsRUFBRSxDQUFDLEdBQUc7QUFDZiw0QkFBQSxVQUFVLEVBQUUsSUFBSTs0QkFDaEIsV0FBVztBQUNaLHlCQUFBLENBQ0YsQ0FBQzt3QkFDRixNQUFNO0FBRVIsb0JBQUEsS0FBQSxDQUFBO0FBQ0Usd0JBQUEsS0FBSyxHQUFHLE1BQU0sR0FBRyxZQUFZLENBQWlELEVBQUEseUJBQUEsRUFBQSx5QkFBQSxTQUFBLG1CQUFBLEdBQUcsQ0FBQyxDQUFDO0FBQ25GLHdCQUFBLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ3RCLE1BQU07QUFFUixvQkFBQSxLQUFBLENBQUE7QUFDRSx3QkFBQSxJQUFJLEdBQUcsTUFBTSxHQUFHLFlBQVksaUZBQStDLENBQUM7d0JBQzVFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQzt3QkFDZCxNQUFNO0FBRVIsb0JBQUEsS0FBQSxDQUFBO0FBQ0Usd0JBQUEsTUFBTSxHQUFHLE1BQU0sR0FBRyxtQkFBbUIsQ0FBMEIsRUFBQSxvQkFBQSxTQUFBLG1CQUFBO0FBQzdELDRCQUFBLE1BQU0sRUFBRSxHQUFHO0FBQ1gsNEJBQUEsTUFBTSxFQUFFLEdBQUc7NEJBQ1gsVUFBVTtBQUNYLHlCQUFBLENBQUMsQ0FBQzt3QkFDSCxNQUFNO0FBRVIsb0JBQUEsS0FBQSxDQUFBO3dCQUNFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxHQUFHLFdBQVcsRUFBRSxFQUFFLENBQUM7d0JBQ3RDLE1BQU07QUFFUixvQkFBQSxLQUFBLENBQUE7QUFDRSx3QkFBQSxLQUFLLEdBQUcsTUFBTSxHQUFHLFdBQVcsQ0FBdUIsRUFBQSxpQkFBQSxTQUFBLG1CQUFBO0FBQ2pELDRCQUFBLE1BQU0sRUFBRSxHQUFHO0FBQ1gsNEJBQUEsRUFBRSxFQUFFLENBQUM7NEJBQ0wsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUNYLHlCQUFBLENBQUMsQ0FBQztBQUNILHdCQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ2pCLE1BQU07QUFDVCxpQkFBQTtBQUNELGdCQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxRQUFRLEdBQUcsQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7QUFDN0QsZ0JBQUEsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxHQUFHLFFBQVEsSUFBSSxRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzNELGFBQUE7QUFDSCxTQUFDLENBQUMsQ0FBQztRQUVILElBQUksTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNoQixLQUFLLEdBQUcsMkZBQTJELENBQUM7QUFDckUsU0FBQTtBQUFNLGFBQUE7QUFDTCxZQUFBLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksdUJBQWUsQ0FBQztBQUM1RCxZQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEdBQUc7QUFBRSxnQkFBQSxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUEsQ0FBQSxzQkFBa0I7WUFDbkQsS0FBSyxDQUFDLElBQUksQ0FBQSxDQUFBLG9CQUFjLENBQUM7WUFDekIsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2hCLFNBQUE7QUFFRCxRQUFBLElBQUksS0FBSztBQUFFLFlBQUEsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7QUFDakMsUUFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxNQUFNLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUVuRCxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsRUFBRSxHQUFHLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxNQUFNLEVBQUUsR0FBRyxJQUFJLEVBQUUsU0FBVSxFQUFFLEtBQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztBQUN2RyxLQUFDLENBQUM7SUFFRixNQUFNLFVBQVUsR0FBRyxNQUFLO1FBQ3RCLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzFCLEdBQUcsQ0FBQyxhQUFhLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDO0FBRS9CLFFBQUEsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxFQUFFLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7QUFDM0csS0FBQyxDQUFDO0lBRUYsTUFBTSxRQUFRLEdBQUcsTUFBSztRQUNwQixZQUFZLEdBQUcsSUFBSSxDQUFDO0FBQ3BCLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFLO0FBQ2xCLFlBQUEsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN0QixZQUFBLFNBQVMsQ0FDUCxFQUFFLEdBQ0QsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLEdBQ2hCLENBQUMsRUFDRCxVQUFVLEVBQ1YsQ0FBQyxDQUFDLEtBQUk7QUFDSixnQkFBQSxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQzthQUNqQixFQUNELE1BQUs7Z0JBQ0gsSUFBSSxJQUFJLEdBQUcsQ0FBQztvQkFDVixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUc7d0JBQ2IsS0FBSzt3QkFDTCxLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQU07QUFDcEIsd0JBQUEsSUFBSSxFQUFFLFlBQVk7d0JBQ2xCLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQzt3QkFDWCxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7d0JBQ1gsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTO3FCQUM1QixDQUFDO0FBRUosZ0JBQUEsVUFBVSxFQUFFLENBQUM7Z0JBQ2IsWUFBWSxHQUFHLEtBQUssQ0FBQztBQUVyQixnQkFBQSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLGdCQUFBLFNBQVMsQ0FBQyxFQUFFLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUUsYUFBQyxDQUNGLENBQUM7QUFDSixTQUFDLENBQUMsQ0FBQztBQUNMLEtBQUMsQ0FBQztJQUVGLE1BQU0sUUFBUSxHQUFHLE1BQUs7O0FBRXBCLFFBQUEsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN0QixRQUFBLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDekIsUUFBQSxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztRQUVsRCxTQUFTLENBQ1AsRUFBRSxHQUNELEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssR0FBRyxDQUFDLEdBQ2pDLENBQUMsRUFDRCxVQUFVLEVBQ1YsQ0FBQyxDQUFDLEtBQUk7WUFDSixLQUFLLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDLFlBQUEsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7U0FDakQsRUFDRCxNQUFLO0FBQ0gsWUFBQSxPQUFPLEVBQUUsQ0FBQztZQUNWLElBQUksQ0FBQyxZQUFZLENBQXdCLENBQUEsOEJBQUEsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNoRSxTQUFDLENBQ0YsQ0FBQztBQUNKLEtBQUMsQ0FBQztJQUVGLE1BQU0sT0FBTyxHQUFHLE1BQUs7UUFDbkIsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBRWxCLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDZixTQUFTLEdBQUcsRUFBRSxDQUFDO1FBQ2YsS0FBSyxHQUFHLEVBQUUsQ0FBQztRQUNYLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFDWixJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1osS0FBQyxDQUFDO0FBRUYsSUFBQSxTQUFTLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQzs7QUFHekcsSUFBQSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLElBQUEsU0FBUyxDQUNQLEVBQUUsRUFDRixDQUFDLEVBQ0QsQ0FBQyxFQUNELFVBQVUsRUFDVixDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUN4QixNQUFNLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQy9CLENBQUM7QUFFRixJQUFBLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN6QixJQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDO0lBRTFCLE9BQU8sQ0FBQyxFQUFVLEtBQUk7QUFDcEIsUUFBQSxJQUFJLFlBQVk7WUFBRSxPQUFPO1FBRXpCLElBQUksSUFBSSxFQUFFLENBQUM7QUFFWCxRQUFBLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDMUIsTUFBTSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUNoQyxZQUFBLE1BQU0sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUM7WUFFekQsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsRUFBRTtBQUNwRCxnQkFBQSxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzFCLGdCQUFBLFFBQVEsRUFBRSxDQUFDO0FBQ1osYUFBQTtBQUNGLFNBQUE7UUFFRCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFBRSxPQUFPOztBQUcxQixRQUFBLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFO0FBQ3BCLFlBQUEsSUFBSSxhQUFhLEVBQUU7QUFDakIsZ0JBQUEsTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQztBQUNuQixnQkFBQSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztBQUNuQixhQUFBO0FBQU0saUJBQUEsSUFBSSxjQUFjLEVBQUU7QUFDekIsZ0JBQUEsTUFBTSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7QUFDbEIsZ0JBQUEsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNwQixhQUFBO0FBQU0saUJBQUE7QUFDTCxnQkFBQSxNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUNqQixhQUFBO0FBQ0QsWUFBQSxJQUFJLFdBQVcsRUFBRTtnQkFDZixJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUU7QUFDckIsb0JBQUEsU0FBUyxvQkFBWSxDQUFDO0FBQ3RCLG9CQUFBLE1BQU0sQ0FBQyxFQUFFLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQztBQUM5QixvQkFBQSxNQUFNLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztBQUMxQixvQkFBQSxNQUFNLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztBQUN0QixpQkFBQTtBQUNGLGFBQUE7QUFDRixTQUFBO1FBRUQsSUFBSSxNQUFNLENBQUMsVUFBVSxFQUFFO0FBQ3JCLFlBQUEsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7QUFDekIsU0FBQTtBQUFNLGFBQUE7QUFDTCxZQUFBLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBQ3pCLFNBQUE7QUFFRCxRQUFBLE1BQU0sQ0FBQyxFQUFFLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQztBQUN6QixRQUFBLE1BQU0sQ0FBQyxFQUFFLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQztBQUV6QixRQUFBLE1BQU0sQ0FBQyxFQUFFLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQztBQUU5QixRQUFBLE1BQU0sQ0FBQyxFQUFFLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUU1QixRQUFBLE1BQU0sQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQztBQUN0QixRQUFBLE1BQU0sQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQzs7QUFHdEIsUUFBQSxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxLQUFJO1lBQzdCLE1BQU0sU0FBUyxHQUFHLGtCQUFrQixDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUN2RCxJQUFJLFNBQVMsS0FBSyxTQUFTLEVBQUU7QUFDM0IsZ0JBQUEsUUFBUSxTQUFTO0FBQ2Ysb0JBQUEsS0FBQSxDQUFBO0FBQ0Usd0JBQUEsSUFBSSxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBRTtBQUNsQiw0QkFBQSxNQUFNLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztBQUN6Qiw0QkFBQSxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUM3Qix5QkFBQTt3QkFDRCxNQUFNO0FBQ1Isb0JBQUEsS0FBQSxDQUFBO0FBQ0Usd0JBQUEsSUFBSSxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUM7QUFBRSw0QkFBQSxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQzt3QkFDbEMsTUFBTTtBQUNSLG9CQUFBLEtBQUEsQ0FBQTtBQUNFLHdCQUFBLElBQUksTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQUUsNEJBQUEsTUFBTSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7d0JBQ2xDLE1BQU07QUFDUixvQkFBQSxLQUFBLENBQUE7QUFDRSx3QkFBQSxJQUFJLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQztBQUFFLDRCQUFBLE1BQU0sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO3dCQUNsQyxNQUFNO0FBQ1QsaUJBQUE7Z0JBQ0QsSUFBSSxTQUFTLHFDQUE2QixNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRTtBQUN2RCxvQkFBQSxNQUFNLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztBQUMzQixpQkFBQTtBQUNGLGFBQUE7QUFDSCxTQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxLQUFJO1lBQy9CLElBQUksa0JBQWtCLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDM0MsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFO29CQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUNuQyxnQkFBQSxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3pCLGdCQUFBLE9BQU8sS0FBSyxDQUFDO0FBQ2QsYUFBQTtBQUNELFlBQUEsT0FBTyxJQUFJLENBQUM7QUFDZCxTQUFDLENBQUMsQ0FBQzs7UUFHSCxJQUFJLE1BQU0sQ0FBQyxDQUFDLEdBQUcsUUFBUSxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSztBQUFFLFlBQUEsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQVEsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDO0FBQzdGLFFBQUEsSUFBSSxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBUSxHQUFHLE1BQU0sQ0FBQyxLQUFLO1lBQUUsTUFBTSxDQUFDLENBQUMsR0FBRyxRQUFRLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFDN0YsSUFBSSxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU07QUFBRSxZQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBRXZFLFFBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUNyQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLElBQUksTUFBTSxDQUFDLFVBQVU7QUFBRSxnQkFBQSxRQUFRLEVBQUUsQ0FBQztZQUM5RixPQUFPO0FBQ1IsU0FBQTtRQUVELElBQUksS0FBSyxJQUFJLGtCQUFrQixDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDO1lBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRW5FLElBQUksU0FBUyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsRUFBRTtBQUNwRCxZQUFBLEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDN0IsWUFBQSxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQU0sQ0FBQyxDQUFDO0FBQzFCLFlBQUEsU0FBUyxHQUFHLEtBQUssR0FBRyxTQUFTLENBQUM7QUFFOUIsWUFBQSxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDakQsWUFBQSxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUVwQixZQUFBLFNBQVMsb0JBQVksQ0FBQztBQUN2QixTQUFBO0FBRUQsUUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxLQUFJO0FBQ25CLFlBQUEsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDO0FBQ2hCLFlBQUEsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7QUFFL0IsWUFBQSxLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRTtBQUNoQyxnQkFBQSxJQUFJLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsRUFBRTtBQUNuQyxvQkFBQSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2Isb0JBQUEsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDakIsTUFBTTtBQUNQLGlCQUFBO0FBQ0YsYUFBQTtBQUVELFlBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssRUFBRTtBQUNoRCxnQkFBQSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2IsZ0JBQUEsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNsQixhQUFBO0FBRUQsWUFBQSxJQUFJLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUM7Z0JBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQ2xELFNBQUMsQ0FBQyxDQUFDOztBQUdILFFBQUEsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssS0FBSTtZQUMxQixJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLEVBQUU7QUFDcEQsZ0JBQUEsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzNCLGdCQUFBLFNBQVMsb0JBQVksQ0FBQztBQUV0QixnQkFBQSxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO2dCQUNwQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2YsS0FBSyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQztBQUV6QyxnQkFBQSxJQUFJLElBQVksQ0FBQztBQUNqQixnQkFBQSxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFHLENBQUM7QUFDMUIsZ0JBQUEsUUFBUSxJQUFJO0FBQ1Ysb0JBQUEsS0FBQSxDQUFBOztBQUVFLHdCQUFBLElBQUksR0FBRyxlQUFlLENBQUMsK0VBQStDLEVBQWMsU0FBQSxtQkFBQSxJQUFJLENBQUMsQ0FBQzt3QkFDMUYsTUFBTTtBQUNSLG9CQUFBLEtBQUEsQ0FBQTt3QkFDRSxJQUFJLEdBQUcsbUJBQW1CLENBQXVCLEVBQUEsaUJBQUEsU0FBQSxtQkFBQTs0QkFDL0MsVUFBVTtBQUNYLHlCQUFBLENBQUMsQ0FBQzt3QkFDSCxNQUFNO0FBQ1Isb0JBQUEsS0FBQSxDQUFBO3dCQUNFLElBQUksR0FBRyxtQkFBbUIsQ0FBdUIsRUFBQSxpQkFBQSxTQUFBLG1CQUFBOzRCQUMvQyxVQUFVO0FBQ1gseUJBQUEsQ0FBQyxDQUFDO3dCQUNILE1BQU07QUFDVCxpQkFBQTtnQkFDRCxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQztBQUMvRCxnQkFBQSxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDakIsZ0JBQUEsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUVyQixnQkFBQSxTQUFTLENBQ1AsRUFBRSxHQUNELElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxHQUNmLENBQUMsRUFDRCxXQUFXLEVBQ1gsQ0FBQyxLQUFLLEtBQUk7QUFDUixvQkFBQSxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDO0FBQ3pELG9CQUFBLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO2lCQUNwQixFQUNELE1BQUs7QUFDSCxvQkFBQSxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLElBQUksUUFBUSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDakQsb0JBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7QUFFZixvQkFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQUs7QUFDbEIsd0JBQUEsU0FBUyxDQUNQLEVBQUUsR0FDRCxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsR0FDZixDQUFDLEVBQ0QsSUFBSSxFQUNKLENBQUMsS0FBSyxLQUFJO0FBQ1IsNEJBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7eUJBQ3BCLEVBQ0QsTUFBSztBQUNILDRCQUFBLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDOzRCQUNmLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNkLGdDQUFBLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7Z0NBQ3hCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNoQiw2QkFBQTtBQUNILHlCQUFDLENBQ0YsQ0FBQztBQUNKLHFCQUFDLENBQUMsQ0FBQztBQUNMLGlCQUFDLENBQ0YsQ0FBQztBQUVGLGdCQUFBLElBQUksSUFBSSxLQUFpQixDQUFBO29CQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztxQkFDcEMsSUFBSSxJQUFJLDZCQUFxQjtBQUNoQyxvQkFBQSxJQUFJLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLO0FBQUUsd0JBQUEsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNyRCxpQkFBQTtBQUNGLGFBQUE7QUFDSCxTQUFDLENBQUMsQ0FBQztRQUVILElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsRUFBRTtBQUNqRCxZQUFBLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN0QixZQUFBLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM5RCxTQUFBO0FBQ0gsS0FBQyxDQUFDO0FBQ0osQ0FBQzs7QUNuZkQsTUFBTSxXQUFXLEdBQUcsMEJBQTBCLENBQUM7QUFDL0MsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDO0FBRTVCLElBQUksT0FBTyxHQUFrQixFQUFFLENBQUM7QUFFaEMsTUFBTSxzQkFBc0IsR0FBRyxDQUFDLElBQVUsRUFBRSxLQUFhLEVBQUUsS0FBYSxLQUFrQjtJQUN4RixNQUFNLFFBQVEsR0FBRyx1QkFBdUIsQ0FBQztJQUN6QyxNQUFNLFFBQVEsR0FBRyx1QkFBdUIsQ0FBQztBQUN6QyxJQUFBLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUM7QUFDdkIsSUFBQSxNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFhLFNBQUEsb0JBQUUsQ0FBQyxDQUFDO0lBQ3ZGLE1BQU0sVUFBVSxHQUFHLG1CQUFtQixDQUE0QixDQUFBLG9CQUFBLFNBQUEscUJBQUEsRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUNuRixJQUFBLE1BQU0sV0FBVyxHQUFHLG1CQUFtQixvREFBNEIsRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM3RyxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsU0FBUyxFQUFFLFFBQVEsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxRQUFRLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQztBQUM1RixJQUFBLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQWlCLFNBQUEsd0JBQUUsQ0FBQyxDQUFDO0FBQ3JGLElBQUEsTUFBTSxZQUFZLEdBQUcsQ0FBQyxLQUFvQixLQUFJO0FBQzVDLFFBQUEsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDOztRQUUzQyxTQUFTLENBQ1AsRUFBRSxFQUNGLENBQUMsRUFDRCxDQUFDLEVBQ0QsVUFBVSxFQUNWLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQ3hCLE1BQUs7WUFDSCxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDLFlBQVksQ0FBQSxDQUFBLHdCQUFrQixDQUFDO0FBQ3RDLFNBQUMsQ0FDRixDQUFDO0FBQ0osS0FBQyxDQUFDO0FBRUYsSUFBQSxJQUFJLENBQVMsQ0FBQztJQUNkLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUVWLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtRQUNiLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyx3Q0FBd0MsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUMxRSxRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUN4QyxRQUFBLElBQUksSUFBSTtBQUFFLFlBQUEsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQzlELEtBQUE7SUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFFcEMsSUFBQSxXQUFXLEVBQUUsQ0FBQztBQUVkLElBQUEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDaEQsUUFBQSxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLEdBQUcsUUFBUSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUSxHQUFHLEdBQUcsQ0FBQztBQUM1QyxRQUFBLE1BQU0sSUFBSSxHQUFHLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFDMUIsUUFBQSxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQztBQUMzQyxRQUFBLE1BQU0sUUFBUSxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUU7WUFDeEQsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLFdBQVcsR0FBRyxFQUFFLElBQUksQ0FBQztZQUNoQyxDQUFDO1lBQ0QsS0FBSztBQUNOLFNBQUEsQ0FBQyxDQUFDO0FBQ0gsUUFBQSxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsRUFBRSxRQUFRLEVBQUU7WUFDMUQsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLFdBQVcsR0FBRyxFQUFFLElBQUksQ0FBQztZQUNoQyxDQUFDO1lBQ0QsS0FBSztBQUNOLFNBQUEsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxRQUFRLEVBQUU7WUFDekQsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLFdBQVcsR0FBRyxFQUFFLElBQUksQ0FBQztZQUNoQyxDQUFDO1lBQ0QsS0FBSztBQUNOLFNBQUEsQ0FBQyxDQUFDO1FBQ0gsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ2hELEtBQUE7QUFFRCxJQUFBLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDOztBQUdoRSxJQUFBLFNBQVMsQ0FDUCxFQUFFLEVBQ0YsQ0FBQyxFQUNELENBQUMsRUFDRCxVQUFVLEVBQ1YsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsRUFDeEIsT0FBTyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUN4QixDQUFDO0FBRUYsSUFBQSxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFFeEMsSUFBQSxPQUFPLE1BQUs7QUFDVixRQUFBLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDO1FBQzFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDO0FBQzFDLFFBQUEsV0FBVyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQzFDLFFBQUEsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7QUFFbEQsUUFBQSxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDO0FBQUUsWUFBQSxTQUFTLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdEUsS0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBRUYsTUFBTSxXQUFXLEdBQUcsTUFBSztJQUN2QixNQUFNLEdBQUcsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzlDLElBQUEsSUFBSSxHQUFHO0FBQUUsUUFBQSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNyQyxDQUFDLENBQUM7QUFFRixNQUFNLFdBQVcsR0FBRyxNQUFLO0FBQ3ZCLElBQUEsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLGVBQWU7QUFBRSxRQUFBLE9BQU8sQ0FBQyxNQUFNLEdBQUcsZUFBZSxDQUFDO0FBQ3ZFLElBQUEsWUFBWSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQzdELENBQUM7O0FDOUZELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxJQUFVLEtBQWtCO0FBQ3JELElBQUEsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQztJQUN2QixNQUFNLFFBQVEsR0FBRyx1QkFBdUIsQ0FBQztJQUN6QyxNQUFNLFFBQVEsR0FBRyx1QkFBdUIsQ0FBQztJQUN6QyxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsV0FBVyxFQUFFLFFBQVEsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsUUFBUSxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUEsU0FBQSxvQkFBZSxDQUFDLENBQUM7SUFDbEcsTUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLFNBQVMsRUFBRSxRQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLFFBQVEsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFBLFNBQUEsb0JBQWUsQ0FBQyxDQUFDO0lBQ2hHLE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsUUFBUSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDaEYsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxRQUFRLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDckYsSUFBQSxNQUFNLEtBQUssR0FBRyxtQkFBbUIsQ0FBQSxDQUFBLG1CQUFBLFNBQUEsa0JBQXdCLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3pFLElBQUEsTUFBTSxLQUFLLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBaUIsU0FBQSx3QkFBRSxDQUFDLENBQUM7SUFDckYsTUFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQyxJQUFBLE1BQU0sWUFBWSxHQUFHLENBQUMsS0FBb0IsS0FBSTtBQUM1QyxRQUFBLE1BQU0sRUFBRSxPQUFPLEVBQUUsR0FBRyxLQUFLLENBQUM7QUFDMUIsUUFBQSxJQUFJLE9BQU8sS0FBSyxNQUFNLElBQUksT0FBTyxLQUFLLFFBQVEsSUFBSSxPQUFPLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUU7WUFDL0YsU0FBUyxHQUFHLENBQUMsU0FBUyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQzFDLFlBQUEsU0FBUyxzQkFBYyxDQUFDO0FBQ3pCLFNBQUE7QUFBTSxhQUFBLElBQUksT0FBTyxLQUFLLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxFQUFFO0FBQ2pELFlBQUEsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQzNDLFlBQUEsU0FBUyxDQUNQLEVBQUUsR0FDRCxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsR0FDaEIsQ0FBQyxFQUNELFVBQVUsRUFDVixDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUN4QixNQUFLO2dCQUNILEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUNsQixnQkFBQSxJQUFJLFNBQVMsS0FBbUIsQ0FBQTtvQkFBRSxJQUFJLENBQUMsWUFBWSxDQUFBLENBQUEsdUJBQWlCLENBQUM7O29CQUNoRSxJQUFJLENBQUMsWUFBWSxDQUFBLENBQUEsNkJBQXVCLENBQUM7QUFDaEQsYUFBQyxDQUNGLENBQUM7QUFDSCxTQUFBO0FBQ0gsS0FBQyxDQUFDO0lBRUYsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBRWxCLElBQUEsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDOztBQUVsRSxJQUFBLFNBQVMsQ0FDUCxFQUFFLEVBQ0YsQ0FBQyxFQUNELENBQUMsRUFDRCxVQUFVLEVBQ1YsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsRUFDeEIsT0FBTyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUN4QixDQUFDO0FBRUYsSUFBQSxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFFeEMsSUFBQSxPQUFPLE1BQUs7QUFDVixRQUFBLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDO0FBQ3BELFFBQUEsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7QUFDcEQsUUFBQSxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDO0FBRXBELFFBQUEsS0FBSyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ3JDLFFBQUEsS0FBSyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDNUIsS0FBQyxDQUFDO0FBQ0osQ0FBQzs7QUN4REQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxNQUF5QixLQUFVO0FBQ3JELElBQUEsSUFBSSxZQUEwQixDQUFDO0lBRS9CLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFFLENBQUM7SUFDekMsTUFBTSxRQUFRLEdBQUcsdUJBQXVCLENBQUM7SUFDekMsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsUUFBUSxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUV4RixJQUFBLE1BQU0sSUFBSSxHQUFHO1FBQ1gsS0FBSztBQUNMLFFBQUEsTUFBTSxDQUFDLEVBQVUsRUFBQTtBQUNmLFlBQUEsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUVqQixZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDakIsWUFBWSxDQUFHLENBQUMsQ0FBQztTQUNsQjtRQUNELE1BQU0sR0FBQTtZQUNKLE9BQU8sQ0FBQyxTQUFTLEdBQUEsU0FBQSx1QkFBbUI7QUFDcEMsWUFBQSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFbEQsWUFBQSxLQUFLLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ3ZCO0FBQ0QsUUFBQSxZQUFZLENBQUMsSUFBZ0IsRUFBRSxHQUFHLE1BQWEsRUFBQTs7WUFDN0MsSUFBSSxLQUFhLEVBQUUsS0FBYSxDQUFDO0FBQ2pDLFlBQUEsUUFBUSxJQUFJO0FBQ1YsZ0JBQUEsS0FBQSxDQUFBO0FBQ0Usb0JBQUEsWUFBWSxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN2QyxNQUFNO0FBQ1IsZ0JBQUEsS0FBQSxDQUFBO0FBQ0Usb0JBQUEsWUFBWSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN0QyxNQUFNO0FBQ1IsZ0JBQUEsS0FBQSxDQUFBO29CQUNFLEtBQUssR0FBRyxNQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBQSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBSSxDQUFDLENBQUMsQ0FBQztBQUN4QixvQkFBQSxLQUFLLEdBQUcsQ0FBQSxFQUFBLEdBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyw2REFBZ0I7b0JBQ2pDLFlBQVksR0FBRyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUMxRCxNQUFNO0FBQ1QsYUFBQTtTQUNGO0tBQ0YsQ0FBQztJQUNGLElBQUksQ0FBQyxZQUFZLENBQUEsQ0FBQSx3QkFBa0IsQ0FBQztBQUNwQyxJQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQzs7QUMvQ0QsTUFBTSxJQUFJLEdBQUcsWUFBVztBQUN0QixJQUFBLFVBQVUsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBRXZDLElBQUEsV0FBVyxFQUFFLENBQUM7SUFDZCxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFdEIsSUFBQSxJQUFJLEdBQVcsQ0FBQztBQUNoQixJQUFBLElBQUksRUFBVSxDQUFDO0lBQ2YsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ2IsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDO0lBRW5CLE9BQU8sR0FBRyxPQUFPLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQztJQUNqQyxNQUFNLEdBQUcsT0FBTyxPQUFPLEdBQUcsS0FBSyxDQUFDLENBQUM7QUFFakMsSUFBQSxNQUFNLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0IsSUFBQSxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0IsSUFBQSxNQUFNLElBQUksR0FBRyxDQUFDLENBQVMsS0FBSTtRQUN6QixxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUU1QixRQUFBLElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTztBQUVyQixRQUFBLEdBQUcsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDeEIsUUFBQSxFQUFFLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQztRQUNoQixJQUFJLEdBQUcsR0FBRyxDQUFDO0FBRVgsUUFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2hCLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUVkLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNaLEtBQUMsQ0FBQztJQUNGLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNWLENBQUMsQ0FBQztBQUVGLElBQUksRUFBRSJ9
