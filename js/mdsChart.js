class MDSChart {
    constructor(container, data, countryNames) {
        this.container = container;
        this.data = data;
        this.filteredOutData = [];
        this.countryNames = countryNames;
        this.selectedPoints = new Set();
        this.autoZoom = false;
        this.initializeChart();
    }

    initializeChart() {
        const margin = { top: 20, right: 20, bottom: 40, left: 50 };
        const width = 800 - margin.left - margin.right;
        const height = 600 - margin.top - margin.bottom;

        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        // Create main group
        this.g = this.svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        this.xScale = d3.scaleLinear().range([0, width]);
        this.yScale = d3.scaleLinear().range([height, 0]);

        // Store original domains
        this.originalXDomain = null;
        this.originalYDomain = null;

        // Zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 8])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        // Axes
        this.xAxis = this.g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`);

        this.yAxis = this.g.append('g')
            .attr('class', 'y-axis');

        // Axis labels
        this.g.append('text')
            .attr('class', 'x-axis-label')
            .attr('transform', `translate(${width / 2},${height + 35})`)
            .style('text-anchor', 'middle')
            .text('Arbitrary Dimension 1');

        this.g.append('text')
            .attr('class', 'y-axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text('Arbitrary Dimension 2');

        // Tooltip
        this.tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background', 'white')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('padding', '10px')
            .style('box-shadow', '0 2px 10px rgba(0,0,0,0.1)')
            .style('pointer-events', 'none');

        this.updateData(this.data, this.filteredOutData);
    }

    updateData(data, filteredOutData = []) {
        this.data = data;
        this.filteredOutData = filteredOutData || [];
        this.updateScales();
        this.renderPoints();
    }

    updateScales() {
        const allData = [...this.data, ...this.filteredOutData];
        
        if (allData.length === 0) return;

        if (!this.originalXDomain || !this.originalYDomain) {
            this.originalXDomain = d3.extent(allData, d => d.D1);
            this.originalYDomain = d3.extent(allData, d => d.D2);
        }

        if (this.autoZoom && this.data.length > 0) {
            // Auto-zoom to filtered data
            this.xScale.domain(d3.extent(this.data, d => d.D1)).nice();
            this.yScale.domain(d3.extent(this.data, d => d.D2)).nice();
        } else {
            // Use original domain (all data)
            this.xScale.domain(this.originalXDomain).nice();
            this.yScale.domain(this.originalYDomain).nice();
        }

        this.xAxis.call(d3.axisBottom(this.xScale));
        this.yAxis.call(d3.axisLeft(this.yScale));
    }

    renderPoints() {
        // Clear existing points first
        this.g.selectAll('.point-group').remove();
        this.g.selectAll('.filtered-out-point').remove();

        // Render filtered out points first (background)
        if (this.filteredOutData.length > 0) {
            this.g.selectAll('.filtered-out-point')
                .data(this.filteredOutData)
                .enter()
                .append('circle')
                .attr('class', 'filtered-out-point')
                .attr('r', 3)
                .attr('cx', d => this.xScale(d.D1))
                .attr('cy', d => this.yScale(d.D2))
                .attr('fill', '#ccc')
                .attr('opacity', 0.5)
                .style('pointer-events', 'none');
        }

        // Render main points
        if (this.data.length > 0) {
            const pointGroups = this.g.selectAll('.point-group')
                .data(this.data)
                .enter()
                .append('g')
                .attr('class', 'point-group')
                .attr('transform', d => `translate(${this.xScale(d.D1)},${this.yScale(d.D2)})`);

            // Add flag image
            pointGroups.append('image')
                .attr('class', 'country-flag')
                .attr('xlink:href', d => `flags/${d.country.toLowerCase()}.png`)
                .attr('width', 24)
                .attr('height', 16)
                .attr('x', -12)
                .attr('y', -8)
                .style('cursor', 'pointer')
                .on('click', (event, d) => this.handlePointClick(event, d))
                .on('mouseover', (event, d) => this.showTooltip(event, d))
                .on('mouseout', () => this.hideTooltip());

            // Add year text
            pointGroups.append('text')
                .text(d => d.year)
                .attr('text-anchor', 'middle')
                .attr('dy', '1.5em')
                .style('font-size', '10px')
                .style('font-weight', 'bold')
                .style('fill', '#2c3e50')
                .style('pointer-events', 'none');
        }
    }

    handlePointClick(event, d) {
        if (this.onPointClickCallback) {
            this.onPointClickCallback(d);
        }
    }

    updateSelection(selectedPoints) {
        // Clear all selections first
        this.g.selectAll('.country-flag')
            .attr('stroke', null)
            .attr('stroke-width', null);

        // Highlight selected points
        selectedPoints.forEach(point => {
            this.g.selectAll('.point-group')
                .filter(d => d.country === point.country && d.year === point.year)
                .select('.country-flag')
                .attr('stroke', '#e74c3c')
                .attr('stroke-width', '2px');
        });
    }

    showTooltip(event, d) {
        const tooltipContent = this.createTooltipContent(d);
        
        this.tooltip.html(tooltipContent)
            .style('opacity', 1)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px');
    }

    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }

    createTooltipContent(d) {
        // Create a mini histogram for the tooltip
        const margin = { top: 25, right: 10, bottom: 40, left: 10 };
        const width = 220;
        const height = 120;
        
        // Prepare data for positions 1-10
        const positionData = [];
        for (let i = 1; i <= 10; i++) {
            positionData.push({
                label: i.toString(),
                value: d[`position_${i}`],
                type: 'position'
            });
        }

        const total = positionData.reduce((sum, item) => sum + item.value, 0);
        const maxValue = d3.max(positionData, item => item.value);

        // Create SVG for mini histogram
        const svg = d3.create('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Scales
        const xScale = d3.scaleBand()
            .domain(positionData.map(d => d.label))
            .range([0, chartWidth])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, maxValue])
            .range([chartHeight, 0]);

        // Bars
        g.selectAll('.bar')
            .data(positionData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.label))
            .attr('y', d => yScale(d.value))
            .attr('width', xScale.bandwidth())
            .attr('height', d => chartHeight - yScale(d.value))
            .attr('fill', '#3498db');

        // Custom X-axis with (L) and (R) labels
        const xAxis = g.append('g')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(d3.axisBottom(xScale));

        // Add (L) under 1 and (R) under 10 - positioned lower
        xAxis.append('text')
            .attr('x', xScale('1') + xScale.bandwidth() / 2)
            .attr('y', 25) // Increased from 20 to 25
            .attr('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('fill', '#666')
            .text('(L)');

        xAxis.append('text')
            .attr('x', xScale('10') + xScale.bandwidth() / 2)
            .attr('y', 25) // Increased from 20 to 25
            .attr('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('fill', '#666')
            .text('(R)');

        // Add center tick with (C) - positioned lower
        const centerX = (xScale('5') + xScale('6') + xScale.bandwidth()) / 2;
        xAxis.append('line')
            .attr('x1', centerX)
            .attr('x2', centerX)
            .attr('y1', 0)
            .attr('y2', 8) // Longer tick for center
            .attr('stroke', '#000')
            .attr('stroke-width', 1);

        xAxis.append('text')
            .attr('x', centerX)
            .attr('y', 25) // Increased from 20 to 25
            .attr('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('fill', '#666')
            .text('(C)');

        // Title with country name
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text(`${d.country_name} - ${d.year}`);

        // Add summary info
        const summary = `Total: ${d.total_respondents.toLocaleString()}
Refused: ${d.refused} | Don't Know: ${d.dont_know}`;

        return `<div>
            <div style="margin-bottom: 10px;">${svg.node().outerHTML}</div>
            <div style="font-size: 11px; color: #666;">${summary}</div>
        </div>`;
    }

    updatePointSize(size) {
        this.g.selectAll('.country-flag')
            .attr('width', size)
            .attr('height', size * 0.67)
            .attr('x', -size/2)
            .attr('y', -size/2 * 0.67);
    }

    setAutoZoom(autoZoom) {
        this.autoZoom = autoZoom;
        this.updateScales();
        this.renderPoints();
    }

    resetZoom() {
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, d3.zoomIdentity);
    }

    clearSelection() {
        this.g.selectAll('.country-flag')
            .attr('stroke', null)
            .attr('stroke-width', null);
    }

    onPointClick(callback) {
        this.onPointClickCallback = callback;
    }
}