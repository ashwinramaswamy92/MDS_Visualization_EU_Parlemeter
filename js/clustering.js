class ClusterAnalysis {
    constructor() {
        this.clusters = null;
        this.currentAlgorithm = 'dbscan';
    }

    applyDBSCAN(data, epsilon = 0.1, minSamples = 5) {
        const points = data.map(d => [d.D1, d.D2]);
        const clusters = new Array(points.length).fill(-1); // -1 means noise
        let clusterId = 0;

        for (let i = 0; i < points.length; i++) {
            if (clusters[i] !== -1) continue;

            const neighbors = this.regionQuery(points, i, epsilon);
            
            if (neighbors.length < minSamples) {
                clusters[i] = -1; // Mark as noise
            } else {
                this.expandCluster(points, clusters, i, neighbors, clusterId, epsilon, minSamples);
                clusterId++;
            }
        }

        return {
            labels: clusters,
            nClusters: clusterId,
            noisePoints: clusters.filter(c => c === -1).length
        };
    }

    regionQuery(points, pointIndex, epsilon) {
        const neighbors = [];
        const point = points[pointIndex];
        
        for (let i = 0; i < points.length; i++) {
            if (this.distance(point, points[i]) <= epsilon) {
                neighbors.push(i);
            }
        }
        return neighbors;
    }

    expandCluster(points, clusters, pointIndex, neighbors, clusterId, epsilon, minSamples) {
        clusters[pointIndex] = clusterId;
        
        for (let i = 0; i < neighbors.length; i++) {
            const neighborIndex = neighbors[i];
            
            if (clusters[neighborIndex] === -1) {
                clusters[neighborIndex] = clusterId;
            } else if (clusters[neighborIndex] === -1) {
                clusters[neighborIndex] = clusterId;
                
                const newNeighbors = this.regionQuery(points, neighborIndex, epsilon);
                if (newNeighbors.length >= minSamples) {
                    neighbors.push(...newNeighbors.filter(n => !neighbors.includes(n)));
                }
            }
        }
    }

    applyKMeans(data, k = 4) {
        const points = data.map(d => [d.D1, d.D2]);
        const n = points.length;
        
        // Initialize centroids randomly
        let centroids = [];
        for (let i = 0; i < k; i++) {
            const randomIndex = Math.floor(Math.random() * n);
            centroids.push([...points[randomIndex]]);
        }

        let labels = new Array(n).fill(0);
        let changed = true;
        let iterations = 0;

        while (changed && iterations < 100) {
            changed = false;
            
            // Assign points to nearest centroid
            for (let i = 0; i < n; i++) {
                const point = points[i];
                let minDist = Infinity;
                let bestCluster = 0;

                for (let j = 0; j < k; j++) {
                    const dist = this.distance(point, centroids[j]);
                    if (dist < minDist) {
                        minDist = dist;
                        bestCluster = j;
                    }
                }

                if (labels[i] !== bestCluster) {
                    labels[i] = bestCluster;
                    changed = true;
                }
            }

            // Update centroids
            const clusterSums = new Array(k).fill(0).map(() => [0, 0]);
            const clusterCounts = new Array(k).fill(0);

            for (let i = 0; i < n; i++) {
                const cluster = labels[i];
                clusterSums[cluster][0] += points[i][0];
                clusterSums[cluster][1] += points[i][1];
                clusterCounts[cluster]++;
            }

            for (let j = 0; j < k; j++) {
                if (clusterCounts[j] > 0) {
                    centroids[j][0] = clusterSums[j][0] / clusterCounts[j];
                    centroids[j][1] = clusterSums[j][1] / clusterCounts[j];
                }
            }

            iterations++;
        }

        return {
            labels: labels,
            nClusters: k,
            centroids: centroids,
            iterations: iterations
        };
    }

    distance(a, b) {
        return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
    }

    applyClustering(data, algorithm, params) {
        this.currentAlgorithm = algorithm;
        
        switch (algorithm) {
            case 'dbscan':
                return this.applyDBSCAN(data, params.epsilon, params.minSamples);
            case 'kmeans':
                return this.applyKMeans(data, params.k);
            case 'hierarchical':
                return this.applyHierarchical(data, params);
            default:
                return this.applyDBSCAN(data, params.epsilon, params.minSamples);
        }
    }

    applyHierarchical(data, params) {
        // Simple hierarchical clustering (single linkage)
        const points = data.map(d => [d.D1, d.D2]);
        const n = points.length;
        let clusters = points.map((_, i) => [i]);
        
        while (clusters.length > params.maxClusters) {
            let minDist = Infinity;
            let mergeI = -1, mergeJ = -1;
            
            for (let i = 0; i < clusters.length; i++) {
                for (let j = i + 1; j < clusters.length; j++) {
                    const dist = this.clusterDistance(clusters[i], clusters[j], points);
                    if (dist < minDist) {
                        minDist = dist;
                        mergeI = i;
                        mergeJ = j;
                    }
                }
            }
            
            // Merge clusters
            clusters[mergeI] = clusters[mergeI].concat(clusters[mergeJ]);
            clusters.splice(mergeJ, 1);
        }
        
        // Convert to label format
        const labels = new Array(n).fill(-1);
        clusters.forEach((cluster, clusterId) => {
            cluster.forEach(pointIndex => {
                labels[pointIndex] = clusterId;
            });
        });
        
        return {
            labels: labels,
            nClusters: clusters.length,
            method: 'hierarchical'
        };
    }

    clusterDistance(cluster1, cluster2, points) {
        // Single linkage distance
        let minDist = Infinity;
        for (const i of cluster1) {
            for (const j of cluster2) {
                const dist = this.distance(points[i], points[j]);
                if (dist < minDist) minDist = dist;
            }
        }
        return minDist;
    }

    getClusterStats(data, clusteringResult) {
        const stats = {
            algorithm: this.currentAlgorithm,
            nClusters: clusteringResult.nClusters,
            totalPoints: data.length,
            clusterSizes: {},
            noisePoints: 0
        };

        clusteringResult.labels.forEach(label => {
            if (label === -1) {
                stats.noisePoints++;
            } else {
                stats.clusterSizes[label] = (stats.clusterSizes[label] || 0) + 1;
            }
        });

        return stats;
    }
}