'use strict';

// vertex shader source
const vertexShaderSrc = `
precision mediump float;

uniform mat4 uM, uV, uP, uN;

attribute vec3 aPosition, aNormal, aTangent, aTexCoords;

varying vec3 vVertPos; // in eye space
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vTexCoords;

void main() {
    gl_PointSize = 4.0;

    vec4 p = uV * uM * vec4(aPosition, 1.0);
    vVertPos = vec3(p);

    vNormal = normalize(vec3(uN * vec4(aNormal, 0.0)));

    vTangent = normalize(vec3(uN * vec4(aTangent, 0.0)));

    vTexCoords = aTexCoords;

    gl_Position = uP * p;
}
`;

// fragment shader source
const fragmentShaderSrc = `
precision mediump float;

uniform mat4 uM, uV, uP, uN, uVInv;

uniform vec3 uMatAmbient, uMatDiffuse, uMatSpecular;
uniform float uMatShininess;

uniform vec3 lightPos; // in eye space
uniform vec3 lightAmbient, lightDiffuse, lightSpecular;

uniform int uRenderMode;
uniform sampler2D uTextures[9];
uniform samplerCube uTextureCubemap;

varying vec3 vVertPos; // in eye space
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vTexCoords;

vec4 light(vec3 normal) {
    vec3 lightDir = normalize(lightPos - vVertPos);

    vec3 ambient = uMatAmbient * lightAmbient;

    vec3 diffuse = uMatDiffuse * lightDiffuse * max(dot(normal, lightDir), 0.0);

    vec3 reflectDir = reflect(-lightDir, normal);
    vec3 vertDir = normalize(-vVertPos);
    vec3 specular = uMatSpecular * lightSpecular * pow(max(dot(reflectDir, vertDir), 0.0), uMatShininess);

    return vec4(ambient + diffuse + specular, 1.0);
}

vec4 sample(vec3 texCoords) {
    int i = int(floor(texCoords[2]+0.5));
    vec2 uv = vec2(texCoords);
         if (i == 0) return texture2D(uTextures[0], uv);
    else if (i == 1) return texture2D(uTextures[1], uv);
    else if (i == 2) return texture2D(uTextures[2], uv);
    else if (i == 3) return texture2D(uTextures[3], uv);
    else if (i == 4) return texture2D(uTextures[4], uv);
    else if (i == 5) return texture2D(uTextures[5], uv);
    else if (i == 6) return texture2D(uTextures[6], uv);
    else if (i == 7) return texture2D(uTextures[7], uv);
    else if (i == 8) return texture2D(uTextures[8], uv);
}

vec4 cube(vec3 dir) {
    return textureCube(uTextureCubemap, dir);
}

void main() {
    if (uRenderMode == 1) {
        vec3 normal = normalize(vNormal);
        gl_FragColor = light(normal);
    } else if (uRenderMode == 2) {
        gl_FragColor = sample(vTexCoords);
    } else if (uRenderMode == 3) {
        vec3 normal = normalize(vNormal);
        vec3 reflectDir = normalize(reflect(normalize(vVertPos), normal));
        reflectDir = vec3(uVInv * vec4(reflectDir, 0.0));
        gl_FragColor = cube(reflectDir);
    } else if (uRenderMode == 4) {
        vec3 normal = normalize(vNormal);
        vec3 tangent = normalize(vTangent);
        tangent = normalize(tangent - dot(tangent, normal) * normal);
        vec3 bitangent = cross(normal, tangent);
        vec3 bumpnormal = normalize(vec3(sample(vTexCoords + vec3(0.0, 0.0, 1.0))) * 2.0 - 1.0);
        mat3 TBN = mat3(tangent, bitangent, normal);
        normal = normalize(TBN * bumpnormal);
        gl_FragColor = sample(vTexCoords) * light(normal);
    } else {
        discard;
    }
}
`;

var canvas;
var gl; // the graphics context (gc)
var shader; // the shader program

var camera; // camera
var skybox; // skybox
var light; // light
var root; // root of primitives
var curr; // current primitive

var controllerMode = translate; // a function in {translate, rotate, scale}
var controllerAxis = 0; // current axis 0: x, 1: y, 2: z

class EmptyNode {
    parent = null;
    children = [];

    transform = mat4.create();

    constructor() {
        this.parent = root;
    }

    // draw every child
    draw(M) {
        this.children.forEach(p => p.draw(mul_m(M, this.transform)));
    }

    // display hierarchy tree
    display(fp, d = 0) {
        fp(this, d);
        this.children.forEach(p => p.display(fp, d + 1));
    }
}

class Primitive extends EmptyNode {
    numVertices = 0; // number of vertices

    position = [];   // position of vertices
    normal = [];     // normal of vertices
    tangent = [];    // tangent of vertices
    texCoords = [];  // texture coordinates of vertices
    matAmbient;      // material ambient
    matDiffuse;      // material diffuse
    matSpecular;     // material specular
    matShininess;    // material shininess
    renderMode = 1;  // render mode 1: no texture, 2: texture, 3: cubemap

    updated = false; // buffer updated?
    bPosition;       // vbo for position of vertices
    bNormal;         // vbo for normal of vertices
    bTangent;        // vbo for tangent of vertices
    bTexCoords;      // vbo for texture coordinates of vertices

    constructor() {
        super();
        // NOTE: default transform is T(0,1,0) for a better user experience
        mat4.fromTranslation(this.transform, v3(0, 1, 0));

        // create buffers
        Primitive.attributes.forEach(({buf}) => this[buf] = gl.createBuffer());
    }

    _drawMode = gl.TRIANGLES;
    get drawMode() { return this._drawMode }
    set drawMode(value) {
        switch (value) {
            case gl.POINTS:
                break;
            case gl.LINES:
                if (this._drawMode == gl.TRIANGLES || this._drawMode == gl.POINTS) {
                    let len = this.position.length;
                    Primitive.attributes.forEach(({dat, n}) => {
                        let newdat = [];
                        for (let i = 0; i < len; i += 9) { // FIXME: Assume n == 3
                            [i, i+3, i+3, i+6, i+6, i].forEach(o => {
                                newdat.push(this[dat][o], this[dat][o+1], this[dat][o+2]);
                            });
                        }
                        this[dat] = newdat;
                    });
                    this.numVertices *= 2;
                    this.updated = false;
                }
                break;
            case gl.POINTS:
            case gl.TRIANGLES:
                if (this._drawMode == gl.LINES) {
                    let len = this.position.length;
                    Primitive.attributes.forEach(({dat, n}) => {
                        let newdat = [];
                        for (let i = 0; i < len; i += 18) { // FIXME: Assume n == 3
                            [i, i+3, i+9].forEach(o => {
                                newdat.push(this[dat][o], this[dat][o+1], this[dat][o+2]);
                            });
                        }
                        this[dat] = newdat;
                    });
                    this.numVertices /= 2;
                    this.updated = false;
                }
                break;
        }
        this._drawMode = value;
    }

    // set material
    // NOTE: currently we assume an object has an uniform material
    setMaterial(ambient, diffuse, specular, shininess) {
        this.matAmbient = ambient;
        this.matDiffuse = diffuse;
        this.matSpecular = specular;
        this.matShininess = shininess;
        this.updated = false;
    }

    generateTangent() {
        this.tangent = new Array(this.position.length);
        this.tangent.fill(0);
        for (let i = 0; i < this.position.length; i += 9) {
            let p0 = v3(...this.position.slice(i, i+3));
            let p1 = v3(...this.position.slice(i+3, i+6));
            let p2 = v3(...this.position.slice(i+6, i+9));

            let edge1 = sub(p1, p0);
            let edge2 = sub(p2, p0);

            let deltaU1 = this.texCoords[i+3+0] - this.texCoords[i+0];
            let deltaV1 = this.texCoords[i+3+1] - this.texCoords[i+1];
            let deltaU2 = this.texCoords[i+6+0] - this.texCoords[i+0];
            let deltaV2 = this.texCoords[i+6+1] - this.texCoords[i+1];

            let f = 1.0 / (deltaU1 * deltaV2 - deltaU2 * deltaV1);

            let tan = normalize(v3(
                f * (deltaV2 * edge1[0] - deltaV1 * edge2[0]),
                f * (deltaV2 * edge1[1] - deltaV1 * edge2[1]),
                f * (deltaV2 * edge1[2] - deltaV1 * edge2[2]),
            ));

            [0, 3, 6].forEach(j => tan.forEach((t, k) => this.tangent[i+j+k] = t));
        }
    }

    // upload vertices data to buffer
    uploadData() {
        if (!this.updated) {
            this.generateTangent();

            Primitive.attributes.forEach(({buf, dat, n}) => {
                if (this[dat].length == 0) {
                    this[dat] = new Array(this.numVertices * n);
                    this[dat].fill(0);
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, this[buf]);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this[dat]), gl.STATIC_DRAW);
            });
            this.updated = true;
        }
    }

    // draw this primitive and children
    // M: parent transform
    draw(M) {
        let M1 = mul_m(M, this.transform); // transform at this level

        this.uploadData();

        // set attribute pointers
        Primitive.attributes.forEach(({att, buf, n}) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, this[buf]);
            gl.vertexAttribPointer(shader[att], n, gl.FLOAT, false, 0, 0);
        });

        // upload data to uniform variables
        gl.uniformMatrix4fv(shader.uM, false, M1);
        gl.uniformMatrix4fv(shader.uN, false, mvToN(mul_m(camera.V, M1)));

        gl.uniform3fv(shader.uMatAmbient, this.matAmbient);
        gl.uniform3fv(shader.uMatDiffuse, this.matDiffuse);
        gl.uniform3fv(shader.uMatSpecular, this.matSpecular);
        gl.uniform1f(shader.uMatShininess, this.matShininess);
        gl.uniform1i(shader.uRenderMode, this.renderMode);

        gl.drawArrays(this.drawMode, 0, this.numVertices);

        this.children.forEach(p => p.draw(M1));
    }

    static setupShader() {
        // setup attribute arrays
        Primitive.attributes.forEach(({att}) => {
            shader[att] = gl.getAttribLocation(shader, att);
            gl.enableVertexAttribArray(shader[att]);
        });
    }
}

// attribute variables
// attribute
// buffer
// data array
// number of components per element
Primitive.attributes = [
    {att: 'aPosition',  buf: 'bPosition',  dat: 'position',  n: 3},
    {att: 'aNormal',    buf: 'bNormal',    dat: 'normal',    n: 3},
    {att: 'aTangent',   buf: 'bTangent',   dat: 'tangent',   n: 3},
    {att: 'aTexCoords', buf: 'bTexCoords', dat: 'texCoords', n: 3},
];

class Plane extends Primitive {
    constructor(size) {
        super();
        this.numVertices = 6;
        let _0 = -0.5 * size, _1 = 0.5 * size;
        this.position = [
            _0, _1, _1,
            _0, _1, _0,
            _1, _1, _0,
            _1, _1, _0,
            _1, _1, _1,
            _0, _1, _1,
        ];
        this.normal = [
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
        ];
        this.texCoords = [
            0, 0, 0,
            1, 0, 0,
            1, 1, 0,
            1, 1, 0,
            0, 1, 0,
            0, 0, 0,
        ];
        this.setMaterial(v3(1, 1, 1), v3(1, 1, 1), v3(1, 1, 1), 3); // XXX: set a default material
    }
}

class Cube extends Primitive {
    constructor(size) {
        super();
        this.numVertices = 36;
        let _0 = -0.5 * size, _1 = 0.5 * size;
        this.position = [
            _0, _1, _0,
            _0, _1, _1,
            _0, _0, _1,
            _0, _0, _1,
            _0, _0, _0,
            _0, _1, _0,
            _1, _1, _1,
            _1, _1, _0,
            _1, _0, _0,
            _1, _0, _0,
            _1, _0, _1,
            _1, _1, _1,
            _1, _1, _0,
            _0, _1, _0,
            _0, _0, _0,
            _0, _0, _0,
            _1, _0, _0,
            _1, _1, _0,
            _0, _1, _1,
            _1, _1, _1,
            _1, _0, _1,
            _1, _0, _1,
            _0, _0, _1,
            _0, _1, _1,
            _0, _0, _1,
            _1, _0, _1,
            _1, _0, _0,
            _1, _0, _0,
            _0, _0, _0,
            _0, _0, _1,
            _0, _1, _0,
            _1, _1, _0,
            _1, _1, _1,
            _1, _1, _1,
            _0, _1, _1,
            _0, _1, _0,
        ];
        this.normal = [
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
        ];
        this.texCoords = [
            0, 0, 0,
            1, 0, 0,
            1, 1, 0,
            1, 1, 0,
            0, 1, 0,
            0, 0, 0,
            0, 0, 1,
            1, 0, 1,
            1, 1, 1,
            1, 1, 1,
            0, 1, 1,
            0, 0, 1,
            0, 0, 2,
            1, 0, 2,
            1, 1, 2,
            1, 1, 2,
            0, 1, 2,
            0, 0, 2,
            0, 0, 3,
            1, 0, 3,
            1, 1, 3,
            1, 1, 3,
            0, 1, 3,
            0, 0, 3,
            0, 0, 4,
            1, 0, 4,
            1, 1, 4,
            1, 1, 4,
            0, 1, 4,
            0, 0, 4,
            0, 0, 5,
            1, 0, 5,
            1, 1, 5,
            1, 1, 5,
            0, 1, 5,
            0, 0, 5,
        ];
        this.setMaterial(v3(1, 1, 1), v3(1, 1, 1), v3(1, 1, 1), 3); // XXX: set a default material
    }
}

class Skybox extends Cube {
    constructor() {
        super(1000);
        this.transform = mat4.create();
        this.renderMode = 2;
    }

    draw(M) {
        mat4.identity(this.transform);
        super.draw(M);
    }
}

class Cylinder extends Primitive {
    constructor(base_r, top_r, height) {
        super();
        const dh = 0.1; // distance between every two circles
        let dr = (base_r - top_r) / (height / dh); // difference of r between every two circles
        // create circles
        for (let i = 0, h = -height / 2; h <= height / 2; i++ , h += dh) {
            this.add_circle(top_r + dr * i, h);
        }
        this.setMaterial(v3(1, 1, 1), v3(1, 1, 1), v3(1, 1, 1), 3); // XXX: set a default material
    }

    // add a circle with radius of r and color of c at plane of y
    add_circle(r, y) {
        const NUM_SLICES = 16;

        // degree to vertex
        const degPos = deg => {
            let _x = r * cos(toRadian(deg));
            let _z = r * sin(toRadian(deg));
            return v3(_x, y, _z);
        };

        // angle per sector
        let angle = 360.0 / NUM_SLICES;
        // create sectors
        for (let i = 0; i < NUM_SLICES; i++) {
            this.add_vertex(v3(0, y, 0));
            this.add_vertex(degPos(angle * i, r, y));
            this.add_vertex(degPos(angle * (i + 1), r, y));
        }
    }

    add_vertex(v) {
        this.numVertices++;
        this.position.push(...v);
        this.normal.push(...normalize(v));
    }
}

class ParametrizedSurface extends Primitive {
    constructor() {
        super();
    }

    generateMesh(sr, tr, psf) {
        for (let s1 = sr[0]; s1 < sr[1]; s1 += sr[2]) {
            let s2 = s1 + sr[2];
            for (let t1 = tr[0]; t1 < tr[1]; t1 += tr[2]) {
                let t2 = t1 + tr[2];
                let v1 = psf(s1, t1);
                let v2 = psf(s1, t2);
                let v3 = psf(s2, t2);
                let v4 = psf(s2, t1);
                this.add_vertices([v1, v2, v3]);
                this.add_vertices([v3, v4, v1]);
            }
        }
    }

    add_vertices(vs) {
        this.numVertices += 3;
        vs.forEach(v => this.position.push(...v[0]));
        if (vs[0][1] != null) {
            vs.forEach(v => this.normal.push(...v[1]));
        } else {
            let d1 = sub(vs[1][0], vs[0][0]);
            let d2 = sub(vs[2][0], vs[0][0]);
            let n = vec3.create();
            vec3.cross(n, d1, d2);
            n = normalize(n);
            this.normal.push(...n);
            this.normal.push(...n);
            this.normal.push(...n);
        }
        vs.forEach(v => this.texCoords.push(...v[2]));
    }
}

class Sphere extends ParametrizedSurface {
    constructor(r) {
        super();
        let sr = [-1.0, 1.0, 0.05];
        let tr = [-0.5, 0.5, 0.025];
        let psf = (s, t) => {
            let p = v3(
                r * cos(pi * t) * cos(pi * s),
                -r * sin(pi * t),
                -r * cos(pi * t) * sin(pi * s),
            );
            let uv = v3(
                (s + 1.0) / 2.0,
                t + 0.5,
                6,
            );
            return [p, normalize(p), uv];
        };
        this.generateMesh(sr, tr, psf);
        this.setMaterial(v3(1, 1, 1), v3(1, 1, 1), v3(1, 1, 1), 3); // XXX: set a default material
    }
}

class Torus extends ParametrizedSurface {
    constructor(r0, r1) {
        super();
        let sr = [-1.0, 1.0, 0.05];
        let tr = [-1.0, 1.0, 0.05];
        let psf = (s, t) => {
            let p = v3(
                (r0 + r1 * cos(pi * t)) * sin(pi * s),
                -r1 * sin(pi * t),
                (r0 + r1 * cos(pi * t)) * cos(pi * s),
            );
            let uv = v3(
                (s + 1.0) / 2.0,
                (t + 1.0) / 2.0,
                6,
            );
            return [p, null, uv];
        };
        this.generateMesh(sr, tr, psf);
        this.setMaterial(v3(1, 1, 1), v3(1, 1, 1), v3(1, 1, 1), 3); // XXX: set a default material
    }
}

class Helicoid extends ParametrizedSurface {
    constructor(b) {
        super();
        let sr = [-1.0, 1.0, 0.05];
        let tr = [-1.0, 1.0, 0.05];
        let psf = (s, t) => {
            let p = v3(
                t * cos(pi * s),
                pi * s * b,
                t * sin(pi * s),
            );
            let uv = v3(
                (s + 1.0) / 2.0,
                (t + 1.0) / 2.0,
                0,
            );
            return [p, null, uv];
        };
        this.generateMesh(sr, tr, psf);
        this.setMaterial(v3(1, 1, 1), v3(1, 1, 1), v3(1, 1, 1), 3); // XXX: set a default material
    }
}

class Model extends Primitive {
    constructor() {
        super();
        // read external model data
        for (let i = 0; i < data.length; i += 12) {
            let normal = [data[i], data[i+2], data[i+1]];
            let v1 = [data[i+3], data[i+ 5], data[i+ 4]];
            let v2 = [data[i+6], data[i+ 8], data[i+ 7]];
            let v3 = [data[i+9], data[i+11], data[i+10]];
            this.position.push(...v1);
            this.position.push(...v2);
            this.position.push(...v3);
            this.normal.push(...normal);
            this.normal.push(...normal);
            this.normal.push(...normal);
            this.numVertices += 3;
        }
        this.position.map(x => x*2);
        this.setMaterial(v3(1, 1, 1), v3(1, 1, 1), v3(1, 1, 1), 3); // XXX: set a default material
    }
}

class Camera extends EmptyNode {
    V = mat4.create();
    P = mat4.create();

    constructor() {
        super();
        this.update();
    }

    draw() {
    }

    // update V, P matrix
    update() {
        // projection matrix
        mat4.perspective(this.P, toRadian(75), canvas.width/canvas.height, 0.01, 1000);

        // view matrix
        mat4.invert(this.V, this.transform);

        // upload data to uniform variables
        gl.uniformMatrix4fv(shader.uV, false, this.V);
        gl.uniformMatrix4fv(shader.uP, false, this.P);
        gl.uniformMatrix4fv(shader.uVInv, false, inv_m(this.V));
    }
}

class Light extends Sphere {
    // light params
    ambient;
    diffuse;
    specular;

    constructor() {
        super(0.2);
        this.setMaterial(v3(10, 10, 10), v3(0, 0, 0), v3(0, 0, 0), 3);

        this.ambient = v3(0.2, 0.2, 0.2);
        this.diffuse = v3(0.7, 0.7, 0.7);
        this.specular = v3(1, 1, 1);
        this.update();
    }

    // upload light params to uniform variables
    update() {
        gl.uniform3fv(shader.lightPos, vec3.transformMat4(vec3.create(), vec3.create(), mul_m(camera.V, this.transform)));
        gl.uniform3fv(shader.lightAmbient, this.ambient);
        gl.uniform3fv(shader.lightDiffuse, this.diffuse);
        gl.uniform3fv(shader.lightSpecular, this.specular);
    }
}

function main() {
    // init webGL-related variables
    initGL();
    initShaders();

    Primitive.setupShader();
    [
        'uM', 'uV', 'uP', 'uN', 'uVInv',
        'uMatAmbient', 'uMatDiffuse', 'uMatSpecular',
        'uMatShininess',
        'lightPos',
        'lightAmbient', 'lightDiffuse', 'lightSpecular',
        'uRenderMode',
        'uTextures',
        'uTextureCubemap',
    ].forEach(v => shader[v] = gl.getUniformLocation(shader, v));

    initTexture2D();
    initTextureCubemap();

    initScene();

    // listen on events
    window.addEventListener('resize', initGL, false);
    document.addEventListener('mousedown', onMouseDown, false);
    document.addEventListener('keydown', onKeyDown, false);

    setInterval(drawScene, 30);
}

function initScene() {
    root = new EmptyNode();
    root.parent = root;
    mat4.fromTranslation(root.transform, v3(0, -1, 0)); // NOTE: Check Primitive's constructor
    curr = root;

    skybox = new Skybox();
    add(skybox);
    curr = root;

    camera = new Camera();
    add(camera);
    mat4.targetTo(camera.transform, v3(-8, 8, -8), v3(0, 6, 0), v3(0, 1, 0));
    curr = root;

    light = new Light();
    add(light);
    mat4.fromTranslation(light.transform, v3(0, 12, 0));
    curr = root;

    add(new Sphere(4));
    curr.renderMode = 2;
}

function getRandomColor() { return v3(Math.random(), Math.random(), Math.random()); }

// get params and create a new primitive with random color
function createPrimitive(name) {
    if (name == 'plane') {
        let s = window.prompt('Size of plane', '1');
        let c = getRandomColor();
        if (s && c) {
            s = parseFloat(s);
            add(new Plane(s));
            curr.setMaterial(c, c, c, 3);
        }
    } else if (name == 'cube') {
        let s = window.prompt('Size of cube', '1');
        let c = getRandomColor();
        if (s && c) {
            s = parseFloat(s);
            add(new Cube(s));
            curr.setMaterial(c, c, c, 3);
        }
    } else if (name == 'cylinder') {
        let rt = window.prompt('Top radius of cylinder', '0.5');
        let rb = window.prompt('Base radius of cylinder', '0.5');
        let h = window.prompt('Height of cylinder', '1');
        let c = getRandomColor();
        if (rt && rb && h && c) {
            rt = parseFloat(rt);
            rb = parseFloat(rb);
            h = parseFloat(h);
            add(new Cylinder(rb, rt, h));
            curr.setMaterial(c, c, c, 3);
        }
    } else if (name == 'sphere') {
        let r = window.prompt('Radius of sphere', '0.5');
        let c = getRandomColor();
        if (r && c) {
            r = parseFloat(r);
            add(new Sphere(r));
            curr.setMaterial(c, c, c, 3);
        }
    } else if (name == 'model') {
        let c = getRandomColor();
        if (c) {
            add(new Model());
            curr.setMaterial(c, c, c, 3);
        }
    } else if (name == 'empty') {
        add(new EmptyNode());
    }
}

// add the new shape under current primitive
// set the new shape's parent field and append it the current's children
// set current to the new primitive
function add(o) {
    o.parent = curr;
    curr.children.push(o);
    curr = o;
}

// delete the current primitive and its children
// remove it from its parent's children field
// set current to its parent
// NOTE: do not delete root, skybox, light, camera
function del() {
    if (curr == root || curr == skybox || curr == light || curr == camera) {
        return;
    }

    curr.parent.children = curr.parent.children.filter(e => e != curr);
    curr = curr.parent;
}

// set controller mode
function setMode(m) {
    controllerMode = m;
}

// set current axis
function setAxis(a) {
    controllerAxis = a;
}

// controller mode
// translate on axis for steps
function translate(obj, axis, step) {
    step *= 2.0;
    let a = vec3.create();
    a[axis] = step;
    mat4.mul(obj.transform, obj.transform, mat4.fromTranslation(mat4.create(), a));
}

// controller mode
// rotate about axis for steps
function rotate(obj, axis, step) {
    step *= toRadian(20);
    let a = vec3.create();
    a[axis] = 1;
    mat4.mul(obj.transform, obj.transform, mat4.fromRotation(mat4.create(), step, a));
}

// controller mode
// scale on axis for steps
function scale(obj, axis, step) {
    step = Math.pow(Math.max(0.1, step+1), 0.5);
    let a = v3(1, 1, 1);
    a[axis] = step;
    mat4.mul(obj.transform, obj.transform, mat4.fromScaling(mat4.create(), a));
}

// set color
function setColor() {
    if (typeof curr.setMaterial !== 'undefined') {
        let v = document.getElementById('colorpicker').value;
        let c = v3(
            Number.parseInt(v.substr(1,2),16) / 255.0,
            Number.parseInt(v.substr(3,2),16) / 255.0,
            Number.parseInt(v.substr(5,2),16) / 255.0,
        );
        curr.setMaterial(c, c, c, 3);
    }
}

// set light color
function setLightColor() {
    let v = document.getElementById('colorpicker-light').value;
    let c = v3(
        Number.parseInt(v.substr(1,2),16) / 255.0,
        Number.parseInt(v.substr(3,2),16) / 255.0,
        Number.parseInt(v.substr(5,2),16) / 255.0,
    );
    light.setMaterial(c.map(x=>x*10), c, c, 3);
    light.ambient = c.map(x=>x*0.2);
    light.diffuse = c.map(x=>x*0.7);
    light.specular = c.map(x=>x*1.0);
}

// clear color buffer and depth buffer
// update camera & light
// draw primitives
function drawScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    updateTreeDisplay();
    camera.update();
    light.update();
    root.draw(mat4.create());
}

// update hierarchy tree display on the web page
function updateTreeDisplay() {
    let str = '';

    root.display((o, d) => str += '| '.repeat(d) + o.constructor.name + (o == curr ? ' <-' : '') + '\n');

    str += '\n';
    str += 'Mode: ' + controllerMode.name + '\n';
    str += 'Axis: ' + 'XYZ'[controllerAxis] + '\n';

    document.getElementById('tree-display').innerText = str;
}

// called when drawing the init scene or resizing window
// get gl context
// calcute viewport params
function initGL() {
    canvas = document.getElementById('canvas-main');
    canvas.width = document.body.clientWidth - document.getElementById('controller').clientWidth - 30;
    if (canvas.width < 240) {
        canvas.width = document.body.clientWidth;
    }
    canvas.height = document.body.clientHeight;

    gl = canvas.getContext('experimental-webgl');
    if (!gl) {
        throw 'Could not init WebGL';
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.1, 0.1, 0.2, 1.0);
}

// create shaders and link program
function initShaders() {
    shader = gl.createProgram(); // create a shader program

    // create, compile, attach a shader
    [[vertexShaderSrc, gl.VERTEX_SHADER], [fragmentShaderSrc, gl.FRAGMENT_SHADER]].forEach(([src, type]) => {
        let _shader = gl.createShader(type);
        gl.shaderSource(_shader, src);
        gl.compileShader(_shader);
        if (!gl.getShaderParameter(_shader, gl.COMPILE_STATUS)) {
            throw gl.getShaderInfoLog(_shader);
        }
        gl.attachShader(shader, _shader);
    });

    gl.linkProgram(shader); // link the vertex and fragment shaders
    if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {
        throw 'Could not init shaders';
    }
    gl.useProgram(shader); // use the shader program
}

function initTexture2D() {
    const textureSrc = [
        'texture/cubemap-dreese/negative-x.jpg',
        'texture/cubemap-dreese/positive-x.jpg',
        'texture/cubemap-dreese/negative-z.jpg',
        'texture/cubemap-dreese/positive-z.jpg',
        'texture/cubemap-dreese/negative-y.jpg',
        'texture/cubemap-dreese/positive-y.jpg',
        'texture/sphere-dreese.jpg',
        'texture/texture-1.jpg',
        'texture/texture-1-bump.jpg',
    ]
    textureSrc.forEach((src, i) => {
        let texture = gl.createTexture();
        let img = new Image();
        img.addEventListener('load', () => {
            gl.activeTexture(gl['TEXTURE'+(i+1)]);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        });
        img.src = src;
    });

    gl.uniform1iv(shader.uTextures, textureSrc.map((v, i) => i+1));
}

function initTextureCubemap() {
    const textureCubemapSrc = [
        ['texture/cubemap-dreese/positive-x.jpg', 1024, gl.TEXTURE_CUBE_MAP_POSITIVE_X],
        ['texture/cubemap-dreese/negative-x.jpg', 1024, gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
        ['texture/cubemap-dreese/positive-y.jpg', 1024, gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
        ['texture/cubemap-dreese/negative-y.jpg', 1024, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
        ['texture/cubemap-dreese/positive-z.jpg', 1024, gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
        ['texture/cubemap-dreese/negative-z.jpg', 1024, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z],
    ];

    let textureCubemap = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, textureCubemap);

    textureCubemapSrc.forEach(([src, dim, type]) => {
        let img = new Image();
        gl.texImage2D(type, 0, gl.RGBA, dim, dim, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        img.addEventListener('load', () => {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, textureCubemap);
            gl.texImage2D(type, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        });
        img.src = src;
    });
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    gl.uniform1i(shader.uTextureCubemap, 0);
}

// handle mouse event
function onMouseDown(event) {
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('mouseup', onMouseUp, false);
    document.addEventListener('mouseout', onMouseOut, false);
    document.removeEventListener('keydown', onKeyDown, false);
}

// handle mouse event
function onMouseUp(event) {
    document.removeEventListener('mousemove', onMouseMove, false);
    document.removeEventListener('mouseup', onMouseUp, false);
    document.removeEventListener('mouseout', onMouseOut, false);
    document.addEventListener('keydown', onKeyDown, false);
}

// handle mouse event
function onMouseOut(event) {
    document.removeEventListener('mousemove', onMouseMove, false);
    document.removeEventListener('mouseup', onMouseUp, false);
    document.removeEventListener('mouseout', onMouseOut, false);
    document.addEventListener('keydown', onKeyDown, false);
}

// handle mouse event
function onMouseMove(event) {
    controllerMode(curr, controllerAxis, -event.movementX / 50);
}

// handle keyboard event
function onKeyDown(event) {
    let hit = true;
    switch (event.keyCode) {
        // move primitive
        case 87: // W
            translate(event.shiftKey ? root : curr, 0, 1);
            break;
        case 83: // S
            translate(event.shiftKey ? root : curr, 0, -1);
            break;
        case 65: // A
            translate(event.shiftKey ? root : curr, 2, -1);
            break;
        case 68: // D
            translate(event.shiftKey ? root : curr, 2, 1);
            break;
        case 81: // Q
            translate(event.shiftKey ? root : curr, 1, 1);
            break;
        case 69: // E
            translate(event.shiftKey ? root : curr, 1, -1);
            break;

        // rotate camera
        case 80: // P
            rotate(camera, 0, event.shiftKey ? 1 : -1);
            break;
        case 89: // Y
            rotate(camera, 1, event.shiftKey ? 1 : -1);
            break;
        case 82: // R
            rotate(camera, 2, event.shiftKey ? 1 : -1);
            break;

        // tree traversal
        case 38: // up
            curr = curr.parent;
            break;
        case 40: // down
            if (curr.children.length > 0) {
                curr = curr.children[0];
            }
            break;
        case 37: // left
            if (curr != root) {
                for (let i = 0; i < curr.parent.children.length; i++) {
                    if (curr.parent.children[i] == curr) {
                        i = Math.max(i - 1, 0);
                        curr = curr.parent.children[i];
                        break;
                    }
                }
            }
            break;
        case 39: // right
            if (curr != root) {
                for (let i = 0; i < curr.parent.children.length; i++) {
                    if (curr.parent.children[i] == curr) {
                        i = Math.min(i + 1, curr.parent.children.length - 1);
                        curr = curr.parent.children[i];
                        break;
                    }
                }
            }
            break;

        case 46: // del
            del();
            break;

        default:
            hit = false;
    }

    if (hit)
        event.preventDefault();
}

// mv matrix to n matrix
function mvToN(mv) {
    let m = mat4.create();
    mat4.invert(m, mv);
    mat4.transpose(m, m);
    return m;
}

// create a vec3 with values
function v3(x, y, z) {
    return vec3.fromValues(x, y, z);
}

// normalize vector
function normalize(v1) {
    let v = vec3.create();
    vec3.normalize(v, v1);
    return v;
}

function sub(v1, v2) {
    let v = vec3.create();
    vec3.sub(v, v1, v2);
    return v;
}

// matrix multiply
function mul_m(m1, m2) {
    let m = mat4.create();
    return mat4.mul(m, m1, m2);
}

// matrix inverse
function inv_m(m1) {
    let m = mat4.create();
    return mat4.invert(m, m1);
}

// degree -> radian
function toRadian(x) {
    return glMatrix.toRadian(x);
}

function sin(x) {
    return Math.sin(x);
}

function cos(x) {
    return Math.cos(x);
}

const pi = Math.PI;
