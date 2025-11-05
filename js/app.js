class MDSVisualization {
    constructor() {
        this.data = null;
        this.countryNames = {};
        this.filteredData = null;
        this.selectedPoints = [];
        this.currentYearRange = [2007, 2025];
        this.selectedCountries = ['all'];
        this.maxHistograms = 10; // Easy to change parameter
        this.autoZoom = false;
        this.showFilteredPoints = true;
        
        this.initializeApp();
    }

    async initializeApp() {
        await this.loadCountryNames();
        await this.loadData();
        this.initializeControls();
        this.createVisualization();
    }

    async loadCountryNames() {
        try {
            const namesData = await d3.csv('data/country_names.csv');
            namesData.forEach(d => {
                this.countryNames[d.code] = d.country;
            });
        } catch (error) {
            console.error('Error loading country names:', error);
            // Fallback to codes if file not found
            const countries = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MK', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'TR', 'UK'];
            countries.forEach(code => {
                this.countryNames[code] = code;
            });
        }
    }

    async loadData() {
        try {
            this.data = await d3.csv('data/mds_survey_distributions_results_ignoring_DK_Refus.csv');
            
            // Convert numeric columns
            this.data.forEach(d => {
                d.year = +d.year;
                d.D1 = +d.D1;
                d.D2 = +d.D2;
                d.total_respondents = +d.total_respondents;
                
                // Convert position counts to numbers
                for (let i = 1; i <= 10; i++) {
                    d[`position_${i}`] = +d[`position_${i}`];
                }
                d.refused = +d.refused;
                d.dont_know = +d.dont_know;
                
                // Add country name
                d.country_name = this.countryNames[d.country] || d.country;
            });

            this.filteredData = this.data;
            this.populateCountrySelect();
            
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    populateCountrySelect() {
        const countrySelect = d3.select('#country-select');
        const countries = [...new Set(this.data.map(d => d.country))].sort();
        
        countrySelect.selectAll('option:not([value="all"])').remove();
        
        countries.forEach(country => {
            const countryName = this.countryNames[country] || country;
            countrySelect.append('option')
                .attr('value', country)
                .text(countryName);
        });
    }

    initializeControls() {
        // Year slider
        const years = [...new Set(this.data.map(d => d.year))].sort();
        const yearSlider = d3.sliderHorizontal()
            .min(d3.min(years))
            .max(d3.max(years))
            .step(0.5)
            .width(200)
            .ticks(5)
            .tickFormat(d3.format('d')) // Remove commas from years
            .default([d3.min(years), d3.max(years)])
            .on('onchange', values => {
                this.currentYearRange = values;
                d3.select('#year-display').text(`${values[0]} - ${values[1]}`);
                this.filterData();
            });

        d3.select('#year-slider')
            .append('svg')
            .attr('width', 250)
            .attr('height', 60)
            .append('g')
            .attr('transform', 'translate(20,20)')
            .call(yearSlider);

        // Country select
        d3.select('#country-select').on('change', () => {
            const selectedOptions = Array.from(
                document.getElementById('country-select').selectedOptions
            ).map(option => option.value);
            
            // If "all" is selected with other countries, keep only "all"
            if (selectedOptions.includes('all') && selectedOptions.length > 1) {
                document.getElementById('country-select').selectedIndex = 0; // Select only "all"
                this.selectedCountries = ['all'];
            } else {
                this.selectedCountries = selectedOptions;
            }
            this.filterData();
        });

        // Point size slider
        d3.select('#point-size').on('input', () => {
            const size = document.getElementById('point-size').value;
            this.mdsChart.updatePointSize(size);
        });

        // Auto-zoom checkbox
        d3.select('#auto-zoom').on('change', (event) => {
            this.autoZoom = event.target.checked;
        });

        // Show filtered points checkbox
        d3.select('#show-filtered').on('change', (event) => {
            this.showFilteredPoints = event.target.checked;
            this.filterData();
        });

        // Reset buttons
        d3.select('#reset-zoom').on('click', () => this.mdsChart.resetZoom());
        d3.select('#clear-selection').on('click', () => this.clearSelection());
    }

    filterData() {
        this.filteredData = this.data.filter(d => {
            const yearInRange = d.year >= this.currentYearRange[0] && d.year <= this.currentYearRange[1];
            const countryInSelection = this.selectedCountries.includes('all') || 
                                   this.selectedCountries.includes(d.country);
            return yearInRange && countryInSelection;
        });

        // Get filtered out data for faint display
        const filteredOutData = this.showFilteredPoints ? 
            this.data.filter(d => {
                const yearInRange = d.year >= this.currentYearRange[0] && d.year <= this.currentYearRange[1];
                const countryInSelection = this.selectedCountries.includes('all') || 
                                       this.selectedCountries.includes(d.country);
                return !(yearInRange && countryInSelection);
            }) : [];

        this.mdsChart.updateData(this.filteredData, filteredOutData);
        
        if (this.autoZoom) {
            this.mdsChart.autoZoom();
        }
    }

    createVisualization() {
        this.mdsChart = new MDSChart('#mds-chart', this.filteredData, this.countryNames);
        this.histogram = new Histogram('#histogram-container', this.countryNames, this.maxHistograms);
        
        // Set up communication between components
        this.mdsChart.onPointClick((pointData) => this.handlePointClick(pointData));
    }

    handlePointClick(pointData) {
        if (this.selectedPoints.length >= this.maxHistograms) {
            this.selectedPoints.shift(); // Remove oldest selection
        }
        
        // Check if this point is already selected
        const existingIndex = this.selectedPoints.findIndex(p => 
            p.country === pointData.country && p.year === pointData.year
        );
        
        if (existingIndex >= 0) {
            // Remove if already selected
            this.selectedPoints.splice(existingIndex, 1);
        } else {
            // Add new selection
            this.selectedPoints.push(pointData);
        }
        
        this.histogram.updateHistograms(this.selectedPoints);
        
        // Update visual selection in MDS chart
        this.mdsChart.updateSelection(this.selectedPoints);
    }

    clearSelection() {
        this.selectedPoints = [];
        this.mdsChart.clearSelection();
        this.histogram.clear();
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MDSVisualization();
});