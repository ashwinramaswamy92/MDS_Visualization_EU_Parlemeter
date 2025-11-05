class Histogram {
    constructor(containerSelector, countryNames, maxHistograms = 10) {
        this.container = d3.select(containerSelector);
        this.countryNames = countryNames;
        this.maxHistograms = maxHistograms;
        this.normalize = false;
        this.currentData = [];
        this.initializeControls();
    }

    initializeControls() {
        d3.select('#normalize-histograms').on('change', (event) => {
            this.normalize = event.target.checked;
            if (this.currentData.length > 0) {
                this.updateHistograms(this.currentData);
            }
        });

        d3.select('#clear-histograms').on('click', () => this.clear());
    }

    updateHistograms(dataPoints) {
        this.currentData = dataPoints;
        this.container.selectAll('.histogram').remove();

        if (dataPoints.length === 0) return;

        // Create individual histograms side by side
        dataPoints.forEach((point, index) => {
            this.createHistogram(point, index);
        });
    }

    createHistogram(data, index) {
        const margin = { top: 40, right: 20, bottom: 60, left: 50 };
        const width = 350 - margin.left - margin.right;
        const height = 250 - margin.top - margin.bottom;

        const svg = this.container.append('svg')
            .attr('class', 'histogram')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Prepare data for positions 1-10
        const positionData = [];
        for (let i = 1; i <= 10; i++) {
            positionData.push({
                label: i.toString(),
                value: data[`position_${i}`],
                type: 'position'
            });
        }

        // Add refused and don't know
        const otherData = [
            // { label: 'Refused', value: data.refused, type: 'refused' },
            // { label: "Don't Know", value: data.dont_know, type: 'dont_know' }
        ];

        const allData = [...positionData, ...otherData];
        const total = this.normalize ? 
            allData.reduce((sum, d) => sum + d.value, 0) : 1;

        // Scales
        const xScale = d3.scaleBand()
            .domain(allData.map(d => d.label))
            .range([0, width])
            .padding(0.2);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(allData, d => this.normalize ? (d.value / total) : d.value)])
            .nice()
            .range([height, 0]);

        // Get color with proper year-based shading
        const color = this.getColor(data.country, data.year, this.currentData);

        // Bars
        svg.selectAll('.bar')
            .data(allData)
            .enter()
            .append('rect')
            .attr('class', d => `bar bar-${d.type}`)
            .attr('x', d => xScale(d.label))
            .attr('y', d => yScale(this.normalize ? (d.value / total) : d.value))
            .attr('width', xScale.bandwidth())
            .attr('height', d => height - yScale(this.normalize ? (d.value / total) : d.value))
            .attr('fill', d => {
                switch(d.type) {
                    case 'position': return color;
                    case 'refused': return '#95a5a6';
                    case 'dont_know': return '#7f8c8d';
                    default: return color;
                }
            })
            .append('title')
            .text(d => `${d.label}: ${this.normalize ? 
                ((d.value / total * 100).toFixed(1) + '%') : 
                d.value.toLocaleString()}`);

        // Custom X-axis
        const xAxis = svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        // Remove the default axis line and ticks
        xAxis.select('.domain').remove();
        xAxis.selectAll('.tick line').remove();

        // Add custom ticks with proper positioning
        const tickData = [
            { position: '1', label: '(L)', isCenter: false },
            { position: '10', label: '(R)', isCenter: false },
            { position: '5.5', label: '(C)', isCenter: true }
        ];

        tickData.forEach(tick => {
            let xPos;
            if (tick.isCenter) {
                // Position for center (between 5 and 6)
                xPos = (xScale('5') + xScale('6') + xScale.bandwidth()) / 2;
            } else {
                xPos = xScale(tick.position) + xScale.bandwidth() / 2;
            }

            // Add tick line - longer for center
            const tickLength = tick.isCenter ? 8 : 6;
            xAxis.append('line')
                .attr('x1', xPos)
                .attr('x2', xPos)
                .attr('y1', 0)
                .attr('y2', tickLength)
                .attr('stroke', '#000')
                .attr('stroke-width', 1);

            // Add label
            xAxis.append('text')
                .attr('x', xPos)
                .attr('y', tickLength + 20)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', '#666')
                .text(tick.label);
        });

        // Y-axis with proper spacing
        svg.append('g')
            .call(d3.axisLeft(yScale)
            .tickFormat(d => this.normalize ? 
                d3.format('.0%')(d) : 
                d3.format(',.0f')(d)));

        // Y-axis label with proper spacing
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left + 15) // Increased spacing
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('fill', '#555')
            .text(this.normalize ? 'Percentage' : 'Count');

        // Title with country name and year
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -15)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .text(`${this.countryNames[data.country] || data.country} (${data.year})`);

        // Add color indicator
        svg.append('rect')
            .attr('x', width - 20)
            .attr('y', -20)
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', color)
            .attr('stroke', '#333')
            .attr('stroke-width', 1);
    }

    getColor(countryCode, year, allData) {
        const baseColor = COUNTRY_COLORS[countryCode] || '#999999';
        
        // Check if there are multiple years for the same country
        const sameCountryData = allData.filter(d => d.country === countryCode);
        if (sameCountryData.length <= 1) {
            return baseColor;
        }
        
        // Create different shades for same country - darker for more recent years
        const years = [...new Set(sameCountryData.map(d => d.year))].sort();
        const yearIndex = years.indexOf(year);
        const totalYears = years.length;
        
        // Calculate darkness factor: 0 (lightest) to 1 (darkest) for oldest to newest
        const darkness = yearIndex / (totalYears - 1);
        
        // Convert to HSL and adjust lightness
        const color = d3.color(baseColor);
        const hsl = d3.hsl(color);
        const newLightness = hsl.l * (1 - darkness * 0.5); // Darken by up to 50%
        
        return d3.hsl(hsl.h, hsl.s, newLightness).toString();
    }

    clear() {
        this.container.selectAll('.histogram').remove();
        this.currentData = [];
    }
}