import{t as e}from"./media.Cg94qiE0.js";var t=`
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * vec2(.5, -.5) + .5;
  gl_Position = vec4(aPosition, 0., 1.);
}`,n=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uFrom, uTo, uBrush, uArrival, uFibre;
uniform vec2 uTip, uHandle;
uniform float uProgress, uAspect, uBrushRatio;

void main() {
  if (uProgress <= 0.) {
    gl_FragColor = vec4(texture2D(uFrom, vUv).rgb, 1.);
    return;
  }
  if (uProgress >= 1.) {
    gl_FragColor = vec4(texture2D(uTo, vUv).rgb, 1.);
    return;
  }
  float age = uTip.x - (texture2D(uArrival, vUv).r * 1.235 - .055);
  vec3 colour;
  if (age < -.014) {
    colour = texture2D(uFrom, vUv).rgb;
  } else if (age > .023) {
    colour = texture2D(uTo, vUv).rgb;
  } else {
    float fibre = texture2D(uFibre, vUv * vec2(3.35, 4.9)).r - .5;
    age += fibre * .017;
    float soak = smoothstep(-.0032, .0037, age);
    float rim = smoothstep(-.0042, .0018, age) * (1. - smoothstep(.0032, .015, age));
    vec3 ink = texture2D(uFrom, vUv).rgb;
    vec3 photo = texture2D(uTo, vUv).rgb;
    colour = mix(ink, photo, soak);
    colour *= 1. - .63 * rim * (.79 + .34 * fibre) * vec3(.78, .94, 1.);
  }

  // The stamp is positioned by its bristle tip. A right-leaning handle trails the contact in the vertical direction.
  vec2 d = (vUv - uTip) * vec2(uAspect, 1.);
  vec2 brushAxes = vec2(dot(d, vec2(-uHandle.y, uHandle.x)), dot(d, uHandle));
  float brushLength = min(.43, uAspect * .28);
  // Centre of the tip texel in the trimmed, tip-up stamp.
  vec2 brushUv = vec2(32.5 / 64., .5 / 465.) + brushAxes / (brushLength * vec2(uBrushRatio, 1.));
  if (brushUv.y > -.03 && brushUv.y < .9 && abs(brushUv.x - .55) < .63) {
    float contact = (1. - smoothstep(.03, .62, abs(brushUv.x - .63))) * smoothstep(-.02, .07, brushUv.y);
    colour *= 1. - .18 * contact * (1. - smoothstep(.07, .79, brushUv.y));
  }
  if (brushUv.x > 0. && brushUv.x < 1. && brushUv.y > 0. && brushUv.y < 1.) {
    vec4 brush = texture2D(uBrush, brushUv);
    colour = brush.rgb + colour * (1. - brush.a);
  }
  gl_FragColor = vec4(colour, 1.);
}`;async function r(e){let t=new Image;return t.crossOrigin=`anonymous`,t.src=e,await t.decode(),t}async function i(e,t){let n=new URL(t,document.baseURI);return n.origin!==location.origin||(e.currentSrc||e.src)!==n.href?r(n.href):(await e.decode(),e)}function a(e,t){let n=document.createElement(`canvas`);n.width=e.naturalWidth,n.height=e.naturalHeight;let r=n.getContext(`2d`,{alpha:!1}),i=getComputedStyle(t);r.fillStyle=i.getPropertyValue(`--bone`).trim(),r.fillRect(0,0,n.width,n.height),r.drawImage(e,0,0);let a=t.viewBox.baseVal;r.scale(n.width/a.width,n.height/a.height),r.lineWidth=parseFloat(i.strokeWidth),r.strokeStyle=i.stroke,r.lineCap=`round`,r.lineJoin=`round`;for(let e of t.querySelectorAll(`path`))r.stroke(new Path2D(e.getAttribute(`d`)));return n}function o(e){let r=e.createProgram();for(let[i,a]of[[e.VERTEX_SHADER,t],[e.FRAGMENT_SHADER,n]]){let t=e.createShader(i);e.shaderSource(t,a),e.compileShader(t),e.attachShader(r,t),e.deleteShader(t)}if(e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw Error(e.getProgramInfoLog(r)??`Brush shader failed`);return r}async function s(t,n,s,c,l,u=Promise.resolve()){let[d,f,p,m,h]=await Promise.all([i(t,e(n)),i(s,s.src),r(e(`hero/brush/brush.webp`)),r(e(`hero/brush/reveal-a.png`)),r(e(`hero/brush/paper-fibre.png`))]);if(await u,!l())return null;let g=document.createElement(`canvas`);g.className=`hero__reveal`,g.setAttribute(`aria-hidden`,`true`);let _=g.getContext(`webgl`,{alpha:!1,antialias:!1,depth:!1,stencil:!1});if(!_)return null;let v=()=>_.getExtension(`WEBGL_lose_context`)?.loseContext();try{let e=o(_);_.useProgram(e),_.bindBuffer(_.ARRAY_BUFFER,_.createBuffer()),_.bufferData(_.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),_.STATIC_DRAW);let t=_.getAttribLocation(e,`aPosition`);_.enableVertexAttribArray(t),_.vertexAttribPointer(t,2,_.FLOAT,!1,0,0);let n=t=>_.getUniformLocation(e,t),r=[a(d,c),f,p,m,h],i=[`uFrom`,`uTo`,`uBrush`,`uArrival`,`uFibre`];if(r.forEach((e,t)=>{_.activeTexture(_.TEXTURE0+t),_.bindTexture(_.TEXTURE_2D,_.createTexture()),_.pixelStorei(_.UNPACK_PREMULTIPLY_ALPHA_WEBGL,e===p);let r=e===m||e===h;_.pixelStorei(_.UNPACK_COLORSPACE_CONVERSION_WEBGL,r?_.NONE:_.BROWSER_DEFAULT_WEBGL);let a=e===h?_.REPEAT:_.CLAMP_TO_EDGE;_.texParameteri(_.TEXTURE_2D,_.TEXTURE_WRAP_S,a),_.texParameteri(_.TEXTURE_2D,_.TEXTURE_WRAP_T,a),_.texParameteri(_.TEXTURE_2D,_.TEXTURE_MIN_FILTER,_.LINEAR),_.texParameteri(_.TEXTURE_2D,_.TEXTURE_MAG_FILTER,_.LINEAR),_.texImage2D(_.TEXTURE_2D,0,_.RGBA,_.RGBA,_.UNSIGNED_BYTE,e),_.uniform1i(n(i[t]),t)}),_.getError()!==_.NO_ERROR)throw Error(`Brush texture upload failed`);_.uniform1f(n(`uBrushRatio`),p.naturalWidth/p.naturalHeight);let s=n(`uProgress`),l=n(`uAspect`),u=n(`uTip`),y=n(`uHandle`),b=-1;return{canvas:g,set(e){let t=Math.min(1.5,window.devicePixelRatio),n=Math.round(g.clientWidth*t),r=Math.round(g.clientHeight*t);if(!n||!r)return;if(n!==g.width||r!==g.height)g.width=n,g.height=r,_.viewport(0,0,n,r);else if(e===b)return;b=e;let i=-.185+1.37*e,a=.53+.055*Math.sin(i*6.1+.45)+.018*Math.sin(i*15.3),o=.58+.17*Math.sin(i*9.4-.7)+.06*Math.sin(i*23+.15);_.uniform1f(s,e),_.uniform1f(l,n/r),_.uniform2f(u,i,a),_.uniform2f(y,Math.sin(o),-Math.cos(o)),_.drawArrays(_.TRIANGLES,0,3)},destroy(){g.remove(),v()}}}catch(e){throw v(),e}}export{s as createBrushReveal};