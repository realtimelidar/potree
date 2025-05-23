import * as THREE from "../libs/three.js/build/three.module.js";
import {PointCloudMaterial} from "./materials/PointCloudMaterial.js";

export class RTPointcloud {
    constructor() {
        /* node id -> node */
        this.nodes = new Map();

        /* node id -> pointcloud id */
        this.nodes2cloud = new Map();

        /* node id -> points array */
        this.points = new Map();

        /* list of pointcloud ids */
        this.clouds = [];

        /* THREE.PointsMaterial({
            size: 1,
            vertexColors: false,
            color: 0xffffff,
        }); */

        // this.updateT3Points();
    }

    newPointcloud() {
        let id = 0;
        while (this.clouds.includes(id)) {
            id++;
        }

        this.clouds.push(id);
        return id;
    }

    addNodeToPointcloud(node, pointcloudId) {
        const key = JSON.stringify(node);
        if (!this.nodes2cloud.has(key)) {
            this.nodes2cloud.set(key, pointcloudId)
        }
        if (!this.nodes.has(key)) {
            this.nodes.set(key, node);
        }
    }

    doesNodeExist(node) {
        const key = JSON.stringify(node);
        return this.nodes.has(key);
    }

    addPointsToNode(points, node) {
        const key = JSON.stringify(node);
        if (this.nodes.has(key)) {
            this.points.set(key, points);

            const bb = this.computeBoundingBox3D(points);
            const n = this.nodes.get(key);
            n["boundingBox"] = bb;
            this.nodes.set(key, n);

            this.updateT3Points();

            // // all points
            // const pnts = Array.from(this.points.values()).flat();

            // const positions = new Float32Array(pnts.map(x => x.attrs.find(x => x.name == "Position3D").value).flat());
            // const rgba = new Uint8Array(pnts.map(x => x.attrs.find(x => x.name == "ColorRGB").value)/*.map(x => x.concat(255 << 8))*/.flat().map(x => 1.0 /* x >> 8 */));
            // const intensity = new Float32Array(pnts.map(x => x.attrs.find(x => x.name == "Intensity").value).flat())

            // this.t3Points.geometry.attributes.position.array = positions;
            // this.t3Points.geometry.attributes.position.needsUpdate = true;

            // this.t3Points.geometry.attributes.color.array = rgba;
            // this.t3Points.geometry.attributes.color.needsUpdate = true;

            // this.t3Points.geometry.attributes.intensity.array = intensity;
            // this.t3Points.geometry.attributes.intensity.needsUpdate = true;

            // this.t3Points.geometry.computeBoundingBox();
        }
    }

    updateT3Points() {
        if (!this.material) {
            this.material = new PointCloudMaterial();
        }

        // This is what is going to be rendered,
        // the representation of the pointcloud's points in THREE terms
        const geometry = new THREE.BufferGeometry();

        // all points
        const pnts = Array.from(this.points.values()).flat();

        const positions = new Float32Array(pnts.map(x => x.attrs.find(x => x.name == "Position3D").value).flat());
        const rgba = new Uint8Array(pnts.map(x => x.attrs.find(x => x.name == "ColorRGB").value)/*.map(x => x.concat(255 << 8))*/.flat().map(x => 1.0 /* x >> 8 */));
        const intensity = new Float32Array(pnts.map(x => x.attrs.find(x => x.name == "Intensity").value).flat())

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(rgba, 3, true));
        geometry.setAttribute('intensity', new THREE.BufferAttribute(intensity, 1));

        geometry.computeBoundingBox();

        this.geometry = geometry;

        if (!this.t3Points) {
            this.t3Points = new THREE.Points(this.geometry, this.material);
            viewer.scene.scene.add(Potree.rtPointcloud.t3Points);
        }
    }

    removeNode(node) {
        const key = JSON.stringify(node);

        if (this.nodes.has(key)) {
            this.nodes.remove(key);
        }

        if (this.points.has(key)) {
            this.points.remove(key);
        }

        if (this.nodes2cloud.has(key)) {
            this.nodes2cloud.remove(key);
        }
    }

    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }

    getNodePoints(node) {
        const key = typeof node == "string" ? node : JSON.stringify(node);

        if (this.points.has(key)) {
            return this.points.get(key);
        }

        return [];
    }

    computeBoundingBox3D(points) {
        const [x0, y0, z0] = points[0].attrs.find(x => x.name == "Position3D").value;

        let minX = x0, minY = y0, minZ = z0;
        let maxX = x0, maxY = y0, maxZ = z0;

        for (let i = 1; i < points.length; i++) {
            const [x, y, z] = points[i].attrs.find(x => x.name == "Position3D").value;

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (z < minZ) minZ = z;

            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            if (z > maxZ) maxZ = z;
        }

        return [
            [minX, minY, minZ],
            [maxX, maxY, maxZ]
        ];
    }
}