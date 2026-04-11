export let main_frag = `uniform sampler2D T;
uniform sampler2D S;
uniform vec4 t;
uniform vec4 s;
uniform vec4 r;

// ==================================================================================================
// Noise
//
float hash(vec2 p) {
    p = 17.*fract( p*.3183099+.1 );
    return fract( p.x*p.y*(p.x+p.y) );
}
int periodicNoise;
float noiseFn(vec2 x) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    f = f*f*(3.-2.*f);
    return mix(
        mix(hash(i+vec2(0,0)), hash(i+vec2(1,0)), f.x),
        mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x),
        f.y
    );
}
float noise(vec2 q) {
    if(periodicNoise>0) q.x = .25*sin(q.x);
    mat2 m = mat2(.88,.48,-.48,.88);
    float f = .5*noiseFn( q *= 8. );
    f += .25*noiseFn( q = m*q*2.01 );
    f += .125*noiseFn( q = m*q*2.02 );
    f += .0625*noiseFn( q = m*q*2.03 );
    return f;
}

// ==================================================================================================
// SDFs + Levels
//
float roundMerge(float a, float b) {
    return max(min(a, b), 0.) - length(min(vec2(a, b), 0.)); 
}
float sdCircle(vec2 P, float x, float y, float r) {
    return length(P - vec2(x, y)) - r;
}
float sdRotatedBox(vec2 P, float x, float y, float w, float h, float th) {
    vec2 d = abs(P - vec2(x,y)) - vec2(w,h) * .5;
    return length(max(d,0.)) + min(max(d.x,d.y),0.);
}
float sdCapsule(vec2 p, float x0, float y0, float ra, float x1, float y1, float rb) {
    vec2 pa = vec2(x0, y0),
         pb = vec2(x1, y1) - pa;
    p -= pa;
    float h = dot(pb,pb),
          b = ra-rb;
    vec2 q = vec2( dot(p,vec2(pb.y,-pb.x)), dot(p,pb) )/h,
         c = vec2(sqrt(h-b*b),b);
    q.x = abs(q.x);
    float k = c.x*q.y - c.y*q.x,
          n = dot(q,q);
    return k < 0.0 ? sqrt(h*(n            )) - ra :
           k > c.x ? sqrt(h*(n+1.0-2.0*q.y)) - rb :
                     dot(c,q)                - ra;
}
    d.x = roundMerge(d.x, sdCircle(p, 111.93, 78.66, 50.));
    d.x = roundMerge(d.x, sdCapsule(p, 26.58, -2.89, 25., 127.67, -4.64, 25.));
    return -1.-d;
}
vec2 M1(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 19.38, 52.48, 50., 100., 0.));
    d.x = max(d.x, -sdRotatedBox(p, 72.93, 52.48, 30., 100., 0.));
    return -1.-d;
}
vec2 M2(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, -6.05, 55.81, 100., 125., 0.));
    d.x = roundMerge(d.x, sdRotatedBox(p, -17.47, -12.52, 50., 30., 0.));
    d.x = roundMerge(d.x, sdCapsule(p, -61.74, -2.12, 10., -15.66, -2.12, 10.));
    return -1.-d;
}
vec2 M3(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, -0.07, 97.01, 150., 250., 0.));
    d.x = roundMerge(d.x, sdCapsule(p, 47.90, -32.40, 20., -48.89, -32.43, 20.));
    d.x = roundMerge(d.x, sdRotatedBox(p, -11.32, -17.57, 40., 40., 0.));
    d.x = roundMerge(d.x, sdCapsule(p, -16.80, -1.87, 10., -50.28, -11.81, 20.));
    return -1.-d;
}
vec2 M4(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 70.66, 77.64, 150., 150., 0.));
    d.x = roundMerge(d.x, sdRotatedBox(p, 65.84, 55.43, 31., 150., 0.));
    d.x = roundMerge(d.x, sdCapsule(p, 106.59, -4.28, 20., 23.88, -4.59, 20.));
    return -1.-d;
}
vec2 M5(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 44.34, 48.78, 98.10, 94.01, 0.));
    d.x = roundMerge(d.x, sdCircle(p, 44.24, 1.15, 40.99));
    d.x = max(d.x, -sdCircle(p, 43.92, -6.14, 31.58));
    return -1.-d;
}
vec2 M6(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, -81.57, 63.30, 186.89, 121.37, 0.));
    d.x = max(d.x, -sdRotatedBox(p, -179.33, 81.59, 50., 84.77, 0.));
    d.x = max(d.x, -sdRotatedBox(p, 86.89, 3.76, 154.40, 245.33, 0.));
    d.x = roundMerge(d.x, sdRotatedBox(p, -91.59, -3.02, 50., 35.76, 0.));
    d.x = roundMerge(d.x, sdCircle(p, -24.02, 0.77, 17.11));
    d.x = roundMerge(d.x, sdCircle(p, -47.70, 4.65, 13.44));
    d.x = roundMerge(d.x, sdCircle(p, -143.51, 28.24, 21.01));
    d.x = roundMerge(d.x, sdCircle(p, -66.33, 11.06, 15.48));
    d.x = roundMerge(d.x, sdCircle(p, -118.47, 18.92, 14.61));
    d.x = roundMerge(d.x, sdCircle(p, -93.42, 19.80, 19.27));
    d.x = roundMerge(d.x, sdCircle(p, -168.27, 34.65, 14.02));
    d.x = roundMerge(d.x, sdRotatedBox(p, -137.50, -0.18, 88.66, 56.58, 0.));
    return -1.-d;
}
vec2 M7(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 4.15, 43.37, 300., 300., 0.));
    d.x = roundMerge(d.x, sdCircle(p, 34.45, 6.64, 17.83));
    d.x = roundMerge(d.x, sdCircle(p, -37.15, 10.44, 17.83));
    d.x = roundMerge(d.x, sdCapsule(p, 0.90, 38.33, 33.77, -0.17, 2.73, 19.00));
    d.x = max(d.x, -sdCapsule(p, 0.09, 6.28, 3.37, 0.23, 28.86, 22.00));
    return -1.-d;
}
vec2 M8(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 34.88, 30.21, 94.56, 56.00, 0.));
    d.x = max(d.x, -sdRotatedBox(p, 72.57, 18.35, 39.11, 79.54, 0.));
    return -1.-d;
}
vec2 M9(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 18.02, 57.64, 50., 110., 0.));
    d.x = max(d.x, -sdRotatedBox(p, 89.57, 42., 50., 110., 0.));
    d.x = max(d.x, -sdRotatedBox(p, 99.50, -32.11, 30., 10., 0.));
    return -1.-d;
}
vec2 MA(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 32.26, 57.50, 78.48, 110.29, 0.));
    d.x = max(d.x, -sdRotatedBox(p, 204.79, 72.98, 170.10, 145.49, 0.));
    d.x = max(d.x, -sdRotatedBox(p, 238.47, -62.76, 103.20, 132.51, 0.));
    d.x = roundMerge(d.x, sdCircle(p, 186.82, -14.81, 19.64));
    d.x = roundMerge(d.x, sdRotatedBox(p, 69.71, 1.22, 45.61, 15.62, 0.));
    d.x = roundMerge(d.x, sdCapsule(p, 109.87, -3.83, 13.73, 137.12, 13.48, 14.86));
    d.x = roundMerge(d.x, sdCapsule(p, 53.80, 24.17, 18.27, 98.27, 0.24, 7.));
    return -1.-d;
}
vec2 MB(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, -37.78, 111.78, 150., 250., 0.));
    d.x = roundMerge(d.x, sdCapsule(p, 10.19, -17.63, 20., -112.46, -17.07, 20.));
    d.x = roundMerge(d.x, sdRotatedBox(p, -49.04, 0.05, 40., 46.01, 0.));
    d.x = roundMerge(d.x, sdCapsule(p, -67.50, 15.40, 19.97, -121.84, 15.23, 20.));
    return -1.-d;
}
vec2 MC(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 21.99, 7.92, 300., 300., 0.));
    d.x = roundMerge(d.x, sdCapsule(p, -2.96, -14.13, 16.57, 39.05, -13.99, 16.22));
    d.x = roundMerge(d.x, sdCapsule(p, 17.30, 4.69, 16.91, 17.84, -31.63, 16.83));
    return -1.-d;
}
vec2 MD(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 45.89, 34.25, 100.82, 64.41, 0.));
    d.x = max(d.x, -sdRotatedBox(p, 139.23, -50.95, 97.76, 83.02, 0.));
    d.x = roundMerge(d.x, sdCapsule(p, 112.32, -8.00, 18.32, 164.92, -7.38, 19.13));
    d.x = roundMerge(d.x, sdCapsule(p, 76.77, 1.57, 15.46, 109.60, 12.15, 4.75));
    d.x = roundMerge(d.x, sdCapsule(p, 47.63, -4.25, 15.90, 18.00, -9.89, 17.89));
    d.x = max(d.x, -sdCapsule(p, 115.26, -5.19, 9.10, 163.80, -5.30, 12.67));
    return -1.-d;
}
vec2 ME(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 53.48, 38.82, 129.68, 73.84, 0.));
    d.x = max(d.x, -sdRotatedBox(p, 213.53, -15.55, 113.32, 182.21, 0.));
    d.x = roundMerge(d.x, sdCircle(p, 163.85, 16.56, 18.59));
    d.x = roundMerge(d.x, sdCapsule(p, 99.87, 18.08, 27.15, 76.56, -22.49, 13.31));
    d.x = roundMerge(d.x, sdRotatedBox(p, 63.62, 6.32, 93.34, 17.12, 0.));
    d.x = roundMerge(d.x, sdCapsule(p, 36.04, 18.81, 20.75, 58.99, -23.85, 5.62));
    return -1.-d;
}
vec2 MF(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, -0.48, 30.21, 23.82, 56.00, 0.));
    d.y = max(d.y, -sdRotatedBox(p, 17.31, 30.83, 9.17, 47.52, 0.));
    d.x = max(d.x, -sdRotatedBox(p, 36.35, 23.07, 26.20, 69.39, 0.));
    return -1.-d;
}
vec2 MG(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 26.00, 31.55, 76.82, 58.69, 0.));
    d.x = max(d.x, -sdRotatedBox(p, -33.82, 19.82, 50., 82.48, 0.));
    d.x = roundMerge(d.x, sdCircle(p, -33.82, -22.67, 23.90));
    d.x = roundMerge(d.x, sdCapsule(p, 73.44, -2.32, 19.03, 23.69, -2.18, 18.90));
    d.y = max(d.y, -sdRotatedBox(p, -34.06, -28.47, 9.41, 7.92, 0.));
    d.y = max(d.y, -sdRotatedBox(p, 75.73, 7.27, 11.45, 10.56, 0.));
    return -1.-d;
}
vec2 MH(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 71.31, 40.04, 154.04, 75.27, 0.));
    d.x = roundMerge(d.x, sdRotatedBox(p, 123.01, -0.08, 62.94, 23.22, 0.));
    d.x = roundMerge(d.x, sdCapsule(p, 90.44, 6.87, 15.38, 26.29, 0.37, 21.91));
    d.y = max(d.y, -sdCircle(p, 120.34, -5.81, 7.));
    d.y = max(d.y, -sdCircle(p, 91.29, -22.92, 7.));
    d.y = max(d.y, -sdCircle(p, 63.25, -38.83, 7.));
    d.y = max(d.y, -sdCircle(p, 32.02, -52.75, 7.));
    return -1.-d;
}
vec2 MI(vec2 p) {
    vec2 d = vec2(-10000);
    d.x = max(d.x, -sdRotatedBox(p, 39.98, 43.37, 104.77, 130.66, 0.));
    d.x = max(d.x, -sdRotatedBox(p, 184.77, 3.19, 124.61, 211.16, 0.));
    d.y = max(d.y, -sdRotatedBox(p, 116.24, -48.67, 10., 10., 0.));
    d.y = max(d.y, -sdCircle(p, 95.28, -75.10, 7.));
    d.x = max(d.x, -sdRotatedBox(p, 306.31, -200.32, 185.13, 157.26, 0.));
    d.y = max(d.y, -sdRotatedBox(p, 100.28, -157.86, 10., 10., 0.));
    d.x = roundMerge(d.x, sdCapsule(p, 209.81, -101.05, 84.85, 281.55, -102.25, 23.59));
    d.x = roundMerge(d.x, sdCapsule(p, 98.67, -22.99, 16.65, 73.85, -23.84, 17.34));
    d.x = roundMerge(d.x, sdRotatedBox(p, 4.31, -20.09, 50., 44.52, 0.));
    d.x = roundMerge(d.x, sdCapsule(p, 39.92, 1.43, 16.33, 39.04, -32.99, 18.53));
    d.x = max(d.x, -sdCapsule(p, 149.39, -163.71, 5.00, 226.38, -163.59, 4.88));
    return -1.-d;
}
float mc(vec2 p){vec2 m=M(p);return min(m.x,m.y);}
vec4 sampleWorld(vec2 p, float delta) { // Result: xy -> normal ; z -> dist ; w -> on/off, negative -> rubber
    vec2 eps = vec2(delta, 0);
    vec2 center = M(p);
    float a = mc(p - eps.xy), b = mc(p + eps.xy), c = mc(p - eps.yx), d = mc(p + eps.yx);
    return vec4(
        normalize(vec2(b - a, d - c)),
        min(center.x, center.y),
        .25*(float(a<=0.)+float(b<=0.)+float(c<=0.)+float(d<=0.)) * (center.y < center.x ? -1. : 1.)
    );
}

const vec3 i_PURPLE_SPACE = vec3(.12,.08,.12);

// ==================================================================================================
// Main
//
vec3 sampleBackground(float a, float b, vec2 worldPosBg) {
    return vec3(1,.9,.7) * smoothstep(a,b, noise(0.1 * worldPosBg)) +
        vec3(.7,.9,1) * smoothstep(a,b, noise(0.1 * worldPosBg+9.)) +
        i_PURPLE_SPACE * noise(.0015 * worldPosBg+5.);
}

void main() {
    periodicNoise = 0;

    if( t.z == 0.0 ) {
        vec2 samp = M(t.xy);
        gl_FragColor = gl_FragCoord.x < 1.
            ? vec4(sampleWorld(t.xy, .01).xyz, samp.y<samp.x ? 1. : 0.)
            : sampleWorld(t.xy + vec2(0,.5), .01);
    } else {
        vec2 worldPos = (gl_FragCoord.xy - (0.5*vec2(1024,768))),
             uv = gl_FragCoord.xy/vec2(1024,768),
             worldPosBg;
        uv.y = 1.0 - uv.y;
        worldPos.y *= -1.0;
        worldPosBg = .2*worldPos + .2*t.xy;
        worldPos = worldPos / t.z / 21. + t.xy;

        vec4 itemCanvasSample = texture2D(T, uv),
             playerCanvasSample = texture2D(S, uv),
             world = sampleWorld(worldPos, .5 / t.z / 21.);

        vec3 color = vec3(0);

        // ----- Background+world color ---------------

        if( world.w != 0.0 ) {

            float edge = pow(max(0.,1.+.5*world.z),3.);
            if( world.w < 0.0 ) {
                color = -world.w * (.1+.25*edge) * vec3(.5);
            } else {
                vec2 v = vec2(.3,0.);
                vec2 p = edge > .01 ? worldPosBg + 20.*world.xy*edge : worldPosBg;
                color = 
                    .25 * sampleBackground(.73,.9, p + v.xy) +
                    .25 * sampleBackground(.73,.9, p - v.xy) +
                    .25 * sampleBackground(.73,.9, p + v.yx) +
                    .25 * sampleBackground(.73,.9, p - v.yx);

                vec2 p1 = edge > .01
                    ? .05*worldPos + .2*vec2(world.y,-world.x)*edge
                    : .05*worldPos;

                float stripe = fract(2.*(sin(p1.x)+p1.y));

                vec3 baseColor = (.5+.5*smoothstep(.2,.3,stripe)*smoothstep(.8,.7,stripe))*r.rgb;
                color += world.w * (.1+.5*edge)*baseColor;
            }
        } else {
            color = sampleBackground(.73,.9,worldPosBg);
        }

        // ----- Item color ---------------

        vec2 itemP = 2.*itemCanvasSample.gb-1.;
        float itemD = length(itemP);
        float itemR = max(0.,1.-itemD);
        if( itemCanvasSample.r > 25./255. ) {
            color += itemR * exp(-3.*itemD)*8. * i_PURPLE_SPACE;
            if (s.w > 0.5) {
                float amount = clamp((itemCanvasSample.r - 30./255.) / (30./255.), 0., 1.);
                color += amount * itemR * exp(-10.*length(itemP))*5. * sampleBackground(0.,1.,8.*vec2(atan(itemP.y, itemP.x) + 0.05*t.w, 5.*(itemR - 0.05*t.w)));
            }
        } else if( itemCanvasSample.r > 15./255. ) {
            color -= pow(itemR,2.);
            vec2 sampP = vec2(atan(itemP.y, itemP.x) + 0.05*t.w, 1.*(itemR - 0.01*t.w));
            periodicNoise = 1;
            vec3 samp = i_PURPLE_SPACE * mix(noise(sampP),noise(sampP+vec2(3.14/2.,0)),.5);
            periodicNoise = 0;
            color += (1.-exp(-5.*itemD)) * itemR * 10.*samp;
        } else if( itemCanvasSample.r > 5./255. ) {
            color += smoothstep(0.,.3,itemR)*10.*vec3(1,1,.5)*exp(-(8.+2.*sin(.5*t.w+(worldPos.x+worldPos.y)))*itemD);
        }

        // ----- Player color ---------------

        float playerAmount = playerCanvasSample.r;
        color += vec3(playerAmount) + vec3(1,1,.5) * pow(.5*max(0.,2.-length(worldPos - s.xy)),2.75+.25*sin(.3*t.w));

        // ----- Text color ---------------

        if( playerCanvasSample.b > 0. ) {
            color = clamp(color, 0., 1.);
        }
        color += (
            vec3(.3)+
            sampleBackground(.3,1.,worldPos+9.+0.05*t.w)
        ) * (playerCanvasSample.g + .75*playerCanvasSample.b);
        if(playerCanvasSample.b > 0. &&  playerCanvasSample.b < .5 ) {
            color = mix( color, (10.*playerCanvasSample.b)*i_PURPLE_SPACE, .5 );
        }

        // --------------------------------------
       
        gl_FragColor = vec4(min(vec3(1),color) * s.z, 1);
    }
}
`;
export let main_vert = `attribute vec4 a;

void main()
{
    gl_Position = a;
}
`;
