(function () {
    class Base {
        constructor(constructorOptions) {
            if (!constructorOptions.parent) {
                console.error(`parent property is missing`);
            }
            if (!constructorOptions.options) {
                console.error(`options property is missing`);
            }
            if (!constructorOptions.decorators) {
                console.error(`decorators property is missing`);
            }

            this.checkIfLoad = this.checkIfLoad.bind(this);
            this.checkIfActive = this.checkIfActive.bind(this);
            this.handleResize = this.handleResize.bind(this);
            this.updateUniforms = this.updateUniforms.bind(this);
            this.updatePosition = this.updatePosition.bind(this);
            this.loop = this.loop.bind(this);

            this._parent = constructorOptions.parent;
            this.dataset = this._parent.dataset;

            if (this._parent._camera) {
                this._camera = this._parent._camera;
            }

            this._parentObject = this._parent._group
                ? this._parent._group
                : this._parent._scene
                    ? this._parent._scene
                    : null;

            this._options = Object.assign({}, defaultOptions$1u, constructorOptions.options);
            this._childDecorators = constructorOptions.decorators || [];

            this._debug = this._parent._debug;

            this._shortName = this._options.shortName;
            this._namePrefix = this._options.namePrefix;
            this._options.name = this._options.namePrefix + "-" + this._shortName;
            this._name = this._options.name;

            this._touch = this._parent._touch;
            this._renderer = this._parent._renderer;

            this._active = false;
            this._loaded = false;

            this._loopArray = new FunctionArray();
            this._resizeArray = new FunctionArray();
            this._activePromises = [];

            this._activeFlags = new FunctionArray();
            this._loadFlags = new FunctionArray();

            if (this._parent instanceof HTMLElement) {
                this._component = this._parent;
                this._loadFlags.push(() => {
                    return true;
                });
            } else {
                this._component = this._parent._component;
                this._loadFlags.push(() => {
                    return this._parent._loaded;
                });
            }

            this._activeFlags.push(() => {
                return this._loaded;
            });

            this._positionArray = new ValuesArray();
            this._positionArray.push({
                name: "original",
                value: this._options.position,
            });

            this._rotationArray = new ValuesArray();
            this._rotationArray.push({
                name: "original",
                value: this._options.rotation,
            });

            this._scaleArray = new ValuesArray();
            this._scaleArray.push({
                name: "original",
                value: this._options.scale,
            });

            if (window._masterLoop) {
                this._loopMode = "master";
            } else {
                this._loopMode = "independent";
            }
        }

        update(options) {
            this._options = Object.assign(this._options, options);

            this._positionArray.set({
                name: "original",
                value: this._options.position,
            });

            this._rotationArray.set({
                name: "original",
                value: this._options.rotation,
            });

            this._scaleArray.set({
                name: "original",
                value: this._options.scale,
            });

            this.onupdate();
        }

        async load() {
            this.updatePosition();
            this.handleResize();

            if (this._parent._loopArray) {
                this._parent._loopArray.push(this.loop);
            }
            if (this._parent._resizeArray) {
                this._parent._resizeArray.push(this.handleResize);
            }

            this.onload();
        }

        async unload() {
            this.updatePosition();
            this.handleResize();

            if (this._parent._loopArray) {
                this._parent._loopArray.remove(this.loop);
            }
            if (this._parent._resizeArray) {
                this._parent._resizeArray.remove(this.handleResize);
            }

            this.onunload();
        }

        async init() {
            await Promise.all(
                Object.values(this._childDecorators).map((d) => d.attach(this, {}))
            );

            this.oninit();
        }

        async destroy() {
            if (this.unload) {
                this.unload();
            }

            await Promise.all(
                Object.values(this._childDecorators).map((d) => d.detach(this, {}))
            );

            if (this._meshes) {
                this._meshes.forEach((m) => {
                    m.material.dispose();
                    m.geometry.dispose();
                });
            }

            if (this._mesh) {
                this._mesh.material.dispose();
                this._mesh.geometry.dispose();
            }

            if (this._composer) {
                this._composer.dispose();
            }

            if (this._scene) {
                this._scene.dispose();
            }

            this.ondestroy();
        }

        activate() { }
        deactivate() { }
        oninit() { }
        ondestroy() { }
        onload() { }
        onunload() { }
        onloop() { }
        onresize() { }
        onupdate() { }

        updateUniforms(uniforms) {
            for (let decoratorId in this._decorators) {
                if (this._decorators[decoratorId].updateUniforms) {
                    this._decorators[decoratorId].updateUniforms(uniforms);
                }
            }
            if (this._meshes) {
                this._meshes.forEach(function (m) {
                    if (m.material.uniforms) {
                        for (let key in uniforms) {
                            if (m.material.uniforms.hasOwnProperty(key)) {
                                m.material.uniforms[key].value = uniforms[key];
                            }
                        }
                    }
                });
            }
            if (this._mesh) {
                for (let key in uniforms) {
                    if (this._mesh.material.uniforms && this._mesh.material.uniforms.hasOwnProperty(key)) {
                        this._mesh.material.uniforms[key].value = uniforms[key];
                    }
                }
            }
            if (this._options.uniforms) {
                for (let key in uniforms) {
                    if (this._options.uniforms.hasOwnProperty(key)) {
                        this._options.uniforms[key].value = uniforms[key];
                    }
                }
            }
            if (this._composer) {
                this._composer.updateUniforms(uniforms);
            }
        }

        updatePosition() {
            let object = this._group ? this._group :
                this._mesh ? this._mesh : null;

            if (!object) return;

            let position = this._positionArray.sum();
            if (Math.abs(position.x - object.position.x) > 0.01 ||
                Math.abs(position.y - object.position.y) > 0.01 ||
                Math.abs(position.z - object.position.z) > 0.01) {
                object.position.set(position.x, position.y, position.z);
            }

            let rotation = this._rotationArray.sum();
            if (Math.abs(rotation.x - object.rotation.x) > 0.001 ||
                Math.abs(rotation.y - object.rotation.y) > 0.001 ||
                Math.abs(rotation.z - object.rotation.z) > 0.001) {
                object.rotation.set(rotation.x, rotation.y, rotation.z);
            }

            let scale = this._scaleArray.multiply();
            if (Math.abs(scale.x - object.scale.x) > 0.001 ||
                Math.abs(scale.y - object.scale.y) > 0.001 ||
                Math.abs(scale.z - object.scale.z) > 0.001) {
                object.scale.set(scale.x, scale.y, scale.z);
            }
        }

        async checkIfLoad() {
            let stateChanged = false;

            if (!this._loaded && this._loadFlags.boolReduce()) {
                this._loaded = true;
                stateChanged = true;
            } else if (this._loaded && !this._loadFlags.boolReduce()) {
                this._loaded = false;
                stateChanged = true;
            }

            try {
                await Promise.all(
                    this._decorators
                        ? Object.values(this._decorators).map((d) =>
                            d.checkIfLoad ? d.checkIfLoad() : Promise.resolve()
                        )
                        : []
                );
                if (!stateChanged) {
                    return Promise.resolve();
                }

                if (this._loaded) {
                    if (this.load) {
                        if (this._debug) {
                            console.log("loaded " + this._name);
                        }

                        return this.load().then(this.checkIfActive);
                    } else {
                        return this.checkIfActive();
                    }
                } else {
                    if (this.unload) {
                        if (this._debug) {
                            console.log("unloaded " + this._name);
                        }
                        return this.unload().then(this.checkIfActive);
                    } else {
                        return this.checkIfActive;
                    }
                }
            } catch (reject) {
                console.error(reject);
            }
        }

        cancelLoad() {
            this._activePromises.forEach(function (p) {
                p._canceled = true;
            });
        }

        async checkIfActive() {
            if (this._active) {
                if (!this._activeFlags.boolReduce()) {
                    this._active = false;

                    this.deactivate();

                    if (this._debug) {
                        console.log("inactive " + this._name);
                    }
                }
            } else {
                if (this._activeFlags.boolReduce()) {
                    this._active = true;

                    this.activate();

                    if (this._debug) {
                        console.log("active " + this._name);
                    }
                }
            }

            for (let decoratorId in this._decorators) {
                if (this._decorators[decoratorId].checkIfActive) {
                    this._decorators[decoratorId].checkIfActive();
                }
            }
        }

        handleResize() {
            this._resizeArray.elements.forEach(function (resizeFunc) {
                if (typeof resizeFunc === "function") {
                    resizeFunc();
                }
            });

            this.onresize();
        }

        loop(multiplier) {
            if (this._destruct) return;

            this._loopArray.elements.forEach(function (loopFunc) {
                if (typeof loopFunc === "function") {
                    loopFunc(multiplier);
                }
            });

            this.onloop(multiplier);

            if (this.updatePosition) {
                this.updatePosition();
            }

            if (this._composer) {
                this.render();
            }
        }

        render() {
            if (this._loaded && this._active) {
                this._composer.render(null);
            }
        }
    }
    class Group$1 extends Base {
        constructor(constructorOptions) {
            if (!constructorOptions.parent) {
                console.error(`parent property is missing`);
            }
            if (!constructorOptions.options) {
                console.error(`options property is missing`);
            }
            if (!constructorOptions.decorators) {
                console.error(`decorators property is missing`);
            }
            super({
                parent: constructorOptions.parent,
                options: Object.assign(
                    {},
                    defaultOptions$2b,
                    constructorOptions.options
                ),
                decorators: constructorOptions.decorators,
            });
        }

        async init() {
            this._group = new Group();
            this._group._inactive = true;
            this._group.name = this._options.name;

            if (!this._parentObject) {
                console.warn("parent is missing both _group and _scene properties");
            }

            await Promise.all(
                Object.values(this._childDecorators).map((d) => d.attach(this, {}))
            );

            this.oninit();
        }

        async load() {
            this._parentObject.add(this._group);
            this._parent._loopArray.push(this.loop);
            this._parent._resizeArray.push(this.handleResize);

            this.checkIfActive();

            this.onload();
        }

        async unload() {
            this._parentObject.remove(this._group);
            this._parent._loopArray.remove(this.loop);
            this._parent._resizeArray.remove(this.resize);

            this.checkIfActive();
            this.onunload();
        }

        activate() {
            this._group._inactive = false;
        }

        deactivate() {
            this._group._inactive = true;
        }
    }
    class WeGroup extends Group$1 {
        constructor(parent, options) {
            super({
                parent: parent,
                options: options,
                decorators: decorators$17,
            });

            this.getTextureFromPool = this.getTextureFromPool.bind(this);

            this._poolIndex = 0;
        }

        oninit() {
            let dataItems = this._component.getElementsByClassName("data-item");

            this._poolItems = Array.prototype.map.call(dataItems, (el, index) => {
                let options = datasetToOptions(el.dataset, Object.assign({}, defaultMeshOptions));

                let type, src;
                if (options.src) {
                    src = options.src;
                    type = "image";
                } else if (options.video) {
                    src = options.video;
                    type = "video";
                }

                return {
                    element: el,
                    src: src,
                    type: type
                }

            });

            this._items = [];

            let angles = [];

            for (let i = 0; i < this._options.total; i++) {
                angles.push(i * 3 * Math.PI / 4);
            }

            // angles = angles.sort(() => {
            //     return Math.random() - 0.5;
            // });

            for (let i = 0; i < this._options.total; i++) {
                this._items.push(meshDecorator.attach(this, Object.assign(defaultMeshOptions, {
                    shortName: `we_${i}`,
                    z: -i * ((this._options.maxDepth - this._options.minDepth) / (this._options.total)) + 1000,
                    maxDepth: this._options.maxDepth,
                    minDepth: this._options.minDepth,
                    angle: angles[i],
                    background: this._options.background,
                    defines: this._options.defines
                })));
            }

            // this._items = Array.prototype.map.call(dataItems, (el, index) => {
            //     let options = datasetToOptions(el.dataset, Object.assign({}, defaultMeshOptions));
            //     if (options.src) {
            //         options.uniforms.tDiffuse = {type: "t", src: options.src};
            //     } else if (options.video) {
            //         options.uniforms.tDiffuse = {type: "t", video: options.video};
            //     }

            //     meshDecorator.attach(this, Object.assign(options, {
            //         shortName: `we_${index}`,
            //         z: -index * 1000,
            //         maxDepth: this._options.maxDepth
            //     }));

            //     return {
            //         element: el
            //     };
            // });
        }

        ondestroy() {
            this._items.forEach((item, index) => {
                meshDecorator.detach(this, Object.assign(defaultMeshOptions, {
                    shortName: `we_${index}`
                }));
            });
        }

        getTextureFromPool() {
            let item = this._poolItems[this._poolIndex];
            let texture;

            if (item.type === "image") {
                texture = parseUniforms({
                    tDiffuse: { type: "t", src: item.src }
                }).tDiffuse;
            } else if (item.type === "video") {
                texture = parseUniforms({
                    tDiffuse: { type: "t", video: item.src }
                }).tDiffuse;
            }

            this._poolIndex++;
            this._poolIndex %= this._poolItems.length;

            return texture;
        }
    }

}());