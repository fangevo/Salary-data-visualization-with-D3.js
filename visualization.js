let originalData, worldData;
let mapSvg, barSvg;
let filteredData;
let isLineChartView = false;
let lineChartSvg;

// Load data
Promise.all([
    d3.csv('salary_data.csv'),
    d3.json('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
]).then(([salaryData, world]) => {
    originalData = salaryData;
    worldData = world;

    // Convert string values to numbers
    originalData.forEach(d => {
        d.salary_in_usd = +d.salary_in_usd;
        d.work_year = +d.work_year;
    });
    addToggleButton();
    initializeFilters();
    createMap();
    createBarChart();
    updateVisualizations();
});

function createLegend(minSalary, maxSalary, colorScale) {
    const mapContainer = document.getElementById('container');
    // if (!mapContainer) {
    //     console.error('Container not found!');
    //     return;
    // }

    // 移除已存在的图例
    const existingLegend = document.querySelector('.salary-legend');
    if (existingLegend) {
        existingLegend.remove();
    }

    // 修改图例容器的位置样式，确保在左下角
    const legendContainer = document.createElement('div');
    legendContainer.className = 'salary-legend';
    legendContainer.style.cssText = `
        position: absolute;
        left: 20px;
        bottom: 20px;
        background: rgba(255, 255, 255, 0.9);
        padding: 10px;
        border-radius: 4px;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        z-index: 1000;
        width: 100px;
        pointer-events: none;
    `;

    // 确保父容器有正确的定位
    if (getComputedStyle(mapContainer).position === 'static') {
        mapContainer.style.position = 'relative';
    }

    // 使用 D3 创建 SVG
    const legendSvg = d3.select(legendContainer)
        .append('svg')
        .attr('width', 100)
        .attr('height', 250);

    // 修改渐变的创建方式
    const defs = legendSvg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'salary-gradient')
        .attr('x1', '0%')
        .attr('y1', '100%')
        .attr('x2', '0%')
        .attr('y2', '0%');

    // 使用多个色标来创建更准确的对数渐变
    const numStops = 20;  // 增加渐变点的数量以获得更平滑的过渡
    for (let i = 0; i <= numStops; i++) {
        const t = i / numStops;
        // 使用对数插值来计算薪资值
        const logT = Math.exp(Math.log(minSalary) * (1 - t) + Math.log(maxSalary) * t);
        gradient.append('stop')
            .attr('offset', `${t * 100}%`)
            .attr('stop-color', colorScale(logT));
    }

    // 添加标题
    legendSvg.append('text')
        .attr('x', 0)
        .attr('y', 15)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('Average');

    legendSvg.append('text')
        .attr('x', 0)
        .attr('y', 30)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('Salary (USD)');

    // 添加渐变矩形
    legendSvg.append('rect')
        .attr('x', 10)
        .attr('y', 40)
        .attr('width', 20)
        .attr('height', 150)
        .style('fill', 'url(#salary-gradient)');

    // 创建对数比例尺
    const scale = d3.scaleLog()
        .domain([minSalary, maxSalary])
        .range([150, 0]);

    // 创建轴，只显示最大值和最小值
    const axis = d3.axisRight(scale)
        .tickValues([minSalary, maxSalary])
        .tickFormat(d => `$${d3.format(',.0f')(d / 1000)}k`); // 格式化为 "$XXk" 形式

    // 添加轴
    legendSvg.append('g')
        .attr('transform', 'translate(30, 40)')
        .call(axis)
        .selectAll('text')
        .style('font-size', '10px');

    // 移除轴线和刻度线
    legendSvg.selectAll('.domain, .tick line')
        .remove();


    // 添加轴
    legendSvg.append('g')
        .attr('transform', 'translate(30, 40)')
        .call(axis)
        .selectAll('text')
        .style('font-size', '10px');

    // 添加 "No data" 说明
    legendSvg.append('rect')
        .attr('x', 10)
        .attr('y', 210)
        .attr('width', 20)
        .attr('height', 20)
        .style('fill', '#ccc');

    legendSvg.append('text')
        .attr('x', 35)
        .attr('y', 225)
        .style('font-size', '10px')
        .text('No data');

    // 将图例添加到地图容器
    mapContainer.appendChild(legendContainer);
}



function initializeFilters() {
    // 获取薪资范围
    const salaryExtent = d3.extent(originalData, d => d.salary_in_usd);
    const minSalary = 5000;
    const maxSalary = 450000;
    // const minSalary = 0;
    // const maxSalary = 20000000;

    // 创建范围滑块的HTML结构
    const sliderContainer = d3.select('#salarySlider')
        .append('div')
        .attr('class', 'range-slider');

    sliderContainer.html(`
        <div class="multi-range">
            <input type="range" id="minRange" 
                min="${minSalary}" max="${maxSalary}" 
                value="${minSalary}" step="1000">
            <input type="range" id="maxRange" 
                min="${minSalary}" max="${maxSalary}" 
                value="${maxSalary}" step="1000">
        </div>
        <div class="range-values">
            Salary range: $${d3.format(",")(minSalary)} - $${d3.format(",")(maxSalary)}
        </div>
    `);

    // 添加滑块事件监听器
    const minRange = document.getElementById('minRange');
    const maxRange = document.getElementById('maxRange');
    const rangeValues = sliderContainer.select('.range-values');

    function updateRangeValues() {
        const minVal = Math.min(+minRange.value, +maxRange.value);
        const maxVal = Math.max(+minRange.value, +maxRange.value);

        rangeValues.html(`Salary range: $${d3.format(",")(minVal)} - $${d3.format(",")(maxVal)}`);

        // 更新可视化
        updateVisualizations();
    }

    minRange.addEventListener('input', updateRangeValues);
    maxRange.addEventListener('input', updateRangeValues);

    // 年份复选框事件监听保持不变
    d3.selectAll('input[type="checkbox"]').on('change', updateVisualizations);
}

// 添加切换按钮的函数
function addToggleButton() {
    const button = d3.select('#container')
        .append('button')
        .attr('id', 'viewToggle')
        .style('position', 'absolute')
        .style('left', '20px')
        .style('top', '50%')
        .style('transform', 'translateY(-50%)')
        .style('padding', '10px')
        .style('border-radius', '5px')
        .style('border', '1px solid #ccc')
        .style('background', 'white')
        .style('cursor', 'pointer')
        .style('z-index', '1000')
        .text('Show Trend View')
        .on('click', toggleView);
}

// 添加视图切换函数
function toggleView() {
    isLineChartView = !isLineChartView;
    d3.select('#viewToggle').text(isLineChartView ? 'Show Map View' : 'Show Trend View');

    // 切换年份复选框区域的可见性
    const yearFiltersContainer = d3.select('#yearFilters');
    const yearCheckboxes = d3.select('#yearCheckboxes'); // 假设年份checkbox的容器id为yearCheckboxes

    if (isLineChartView) {
        // 淡出年份checkbox区域
        yearCheckboxes.transition()
            .duration(850)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this).style('display', 'none');
            });
    } else {
        // 显示并淡入年份checkbox区域
        yearCheckboxes
            .style('display', 'block')
            .style('opacity', 0)
            .transition()
            .duration(850)
            .style('opacity', 1);
    }
    const legend = d3.select('.salary-legend');
    if (isLineChartView) {
        legend.transition()
            .duration(850)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this).style('display', 'none');
            });
    } else {
        legend.style('display', 'block')
            .style('opacity', 0)
            .transition()
            .duration(850)
            .style('opacity', 1);
    }

    // 使用过渡动画切换视图
    const duration = 750;

    if (isLineChartView) {
        // 淡出地图和条形图
        mapSvg.transition().duration(duration).style('opacity', 0);
        barSvg.transition().duration(duration).style('opacity', 0)
            .on('end', () => {
                mapSvg.style('display', 'none');
                barSvg.style('display', 'none');
                d3.select('#lineChart').remove();
                createLineChart();
                lineChartSvg
                    .style('opacity', 0)
                    .style('display', 'block')
                    .transition()
                    .duration(duration)
                    .style('opacity', 1);
            });
    } else {
        // 淡出折线图
        if (lineChartSvg) {
            lineChartSvg.transition().duration(duration).style('opacity', 0)
                .on('end', () => {
                    lineChartSvg.remove();
                    mapSvg.style('display', 'block');
                    barSvg.style('display', 'block');
                    updateVisualizations();
                    mapSvg.transition().duration(duration).style('opacity', 1);
                    barSvg.transition().duration(duration).style('opacity', 1);
                });
        }
    }
}


// 添加创建折线图的函数
function createLineChart() {
    // 清除已存在的折线图
    d3.select('#lineChart').remove();

    const container = d3.select('#container');
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    // 调整折线图的宽度和位置
    const width = containerWidth * 0.85;  // 减小宽度为容器的85%
    const height = containerHeight;
    const margin = { top: 60, right: 120, bottom: 60, left: 220 }; // 增加左边距

    // 创建新的SVG元素
    lineChartSvg = container.append('svg')
        .attr('id', 'lineChart')
        .attr('width', width)
        .attr('height', height)
        .style('position', 'absolute')
        .style('top', '0')
        .style('left', '180px');  // 向右移动以避免被过滤器面板遮挡

    const g = lineChartSvg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // 获取当前薪资过滤范围
    const minRange = +document.getElementById('minRange').value;
    const maxRange = +document.getElementById('maxRange').value;

    // 过滤并处理数据
    const filteredData = originalData.filter(d =>
        d.salary_in_usd >= minRange &&
        d.salary_in_usd <= maxRange
    );

    // 按年份和经验水平计算平均薪资
    const yearlyData = Array.from(d3.rollup(filteredData,
        v => ({
            EN: d3.mean(v.filter(d => d.experience_level === 'EN'), d => d.salary_in_usd) || 0,
            MI: d3.mean(v.filter(d => d.experience_level === 'MI'), d => d.salary_in_usd) || 0,
            SE: d3.mean(v.filter(d => d.experience_level === 'SE'), d => d.salary_in_usd) || 0,
            EX: d3.mean(v.filter(d => d.experience_level === 'EX'), d => d.salary_in_usd) || 0,
            ALL: d3.mean(v, d => d.salary_in_usd)
        }),
        d => d.work_year
    )).sort((a, b) => a[0] - b[0]);

    // 创建比例尺
    const x = d3.scaleLinear()
        .domain(d3.extent(yearlyData, d => d[0]))
        .range([0, width - margin.left - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(yearlyData, d => Math.max(d[1].EN, d[1].MI, d[1].SE, d[1].EX))])
        .range([height - margin.top - margin.bottom, 0])
        .nice();

    // 创建线条生成器
    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]))
        .curve(d3.curveMonotoneX);

    // 定义颜色
    const colors = {
        EN: '#1f77b4',
        MI: '#ff7f0e',
        SE: '#2ca02c',
        EX: '#d62728',
        ALL: '#9467bd'
    };

    // 绘制线条
    const levels = ['EN', 'MI', 'SE', 'EX', 'ALL'];
    levels.forEach(level => {
        const lineData = yearlyData.map(d => [d[0], d[1][level]]);

        g.append('path')
            .datum(lineData)
            .attr('class', `line ${level}`)
            .attr('fill', 'none')
            .attr('stroke', colors[level])
            .attr('stroke-width', level === 'ALL' ? 3 : 2)
            .attr('d', line)
            .style('opacity', 0)
            .transition()
            .duration(1000)
            .style('opacity', 1);

        // 添加数据点
        g.selectAll(`.point-${level}`)
            .data(lineData)
            .enter()
            .append('circle')
            .attr('class', `point-${level}`)
            .attr('cx', d => x(d[0]))
            .attr('cy', d => y(d[1]))
            .attr('r', 4)
            .attr('fill', colors[level])
            .style('opacity', 0)
            .transition()
            .duration(1000)
            .style('opacity', 1);
    });

    // 添加坐标轴
    g.append('g')
        .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d => d));

    g.append('g')
        .call(d3.axisLeft(y).tickFormat(d => `$${d3.format(',.0f')(d)}`));

    // 添加标题
    lineChartSvg.append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text('Global Average Salary Trends by Experience Level');

    // 添加坐标轴标签
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -60)
        .attr('x', -(height - margin.top - margin.bottom) / 2)
        .attr('text-anchor', 'middle')
        .text('Average Salary (USD)');

    g.append('text')
        .attr('x', (width - margin.left - margin.right) / 2)
        .attr('y', height - margin.top - margin.bottom + 40)
        .attr('text-anchor', 'middle')
        .text('Year');

    // 添加图例
    const legend = g.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - margin.left - margin.right + 20}, 0)`);

    const legendLabels = {
        EN: 'Entry Level',
        MI: 'Mid Level',
        SE: 'Senior',
        EX: 'Executive',
        ALL: 'Average'
    };

    levels.forEach((level, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 20})`);

        legendItem.append('line')
            .attr('x1', 0)
            .attr('x2', 20)
            .attr('y1', 10)
            .attr('y2', 10)
            .attr('stroke', colors[level])
            .attr('stroke-width', level === 'ALL' ? 3 : 2);

        legendItem.append('text')
            .attr('x', 25)
            .attr('y', 13)
            .style('font-size', '12px')
            .text(legendLabels[level]);
    });
}


function updateVisualizations() {
    // 获取当前过滤器值
    const selectedYears = Array.from(d3.selectAll('input[type="checkbox"]:checked'))
        .map(cb => +cb.value);

    const minRange = document.getElementById('minRange');
    const maxRange = document.getElementById('maxRange');
    const minSalary = Math.min(+minRange.value, +maxRange.value);
    const maxSalary = Math.max(+minRange.value, +maxRange.value);

    // 过滤数据
    filteredData = originalData.filter(d =>
        d.salary_in_usd >= minSalary &&
        d.salary_in_usd <= maxSalary &&
        selectedYears.includes(d.work_year)
    );

    if (isLineChartView) {
        createLineChart();
    } else {
        updateMap();
        updateBarChart();
    }
}


function createMap() {
    const width = d3.select('#map').node().getBoundingClientRect().width;
    const height = d3.select('#map').node().getBoundingClientRect().height;

    // 设置初始旋转角度
    let rotate = [0, 0, 0];
    let velocity = [0.02, 0, 0];
    let lastTime = d3.now();

    mapSvg = d3.select('#map')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // 使用正交投影创建地球仪效果
    const projection = d3.geoOrthographic()
        .scale(height / 2.2)  // 调整地球大小
        .center([0, 0])
        .rotate(rotate)
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // 修改球体背景
    mapSvg.append('circle')
        .attr('cx', width / 2)
        .attr('cy', height / 2)
        .attr('r', projection.scale())
        .attr('class', 'globe')
        .style('fill', '#000')  // 改为黑色
        .style('stroke', '#333')  // 边框也改为深色
        .style('stroke-width', '0.2px');

    // 可以添加一个渐变效果让海洋看起来更有层次感
    const defs = mapSvg.append('defs');
    const gradient = defs.append('radialGradient')
        .attr('id', 'ocean-gradient')
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');

    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#00204b');  // 深蓝黑色

    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#000');  // 纯黑色

    // 更新球体背景的填充
    mapSvg.select('.globe')
        .style('fill', 'url(#ocean-gradient)');

    // 绘制地图
    const map = mapSvg.append('g');
    map.selectAll('path')
        .data(topojson.feature(worldData, worldData.objects.countries).features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('class', 'country');

    // 添加拖拽行为
    const drag = d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);

    let isDragging = false;

    function dragstarted() {
        isDragging = true;
        velocity = [0, 0, 0];
        lastTime = d3.now();
    }

    function dragged(event) {
        const dx = event.dx;
        const dy = event.dy;
        const rotation = projection.rotate();
        const scale = projection.scale();

        velocity = [dx / 8, -dy / 8, 0];
        rotate = [
            rotation[0] + velocity[0],
            rotation[1] + velocity[1],
            rotation[2]
        ];

        projection.rotate(rotate);
        map.selectAll('path').attr('d', path);
    }

    function dragended() {
        isDragging = false;
    }

    // 添加自动旋转动画
    function autoRotate() {
        if (!isDragging) {
            const now = d3.now();
            const diff = now - lastTime;
            lastTime = now;

            if (diff < 100) {
                rotate = projection.rotate();
                rotate[0] += velocity[0];
                projection.rotate(rotate);
                map.selectAll('path').attr('d', path);
            }
        }
        requestAnimationFrame(autoRotate);
    }

    mapSvg.call(drag);
    autoRotate();

    // 添加缩放行为
    const zoom = d3.zoom()
        .scaleExtent([0.8, 5])
        .on('zoom', (event) => {
            const newScale = height / 2.2 * event.transform.k;
            projection.scale(newScale);

            // 更新球体大小
            mapSvg.select('.globe')
                .attr('r', newScale);

            // 更新地图
            map.selectAll('path')
                .attr('d', path);
        });

    mapSvg.call(zoom);
}

function createBarChart() {
    const width = d3.select('#barChart').node().getBoundingClientRect().width;
    const height = d3.select('#barChart').node().getBoundingClientRect().height;

    barSvg = d3.select('#barChart')
        .append('svg')
        .attr('width', width * 2)
        .attr('height', height);

    // Add title
    barSvg.append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Salary Distribution Worldwide');
}

function updateBarChart() {
    // 设置固定的薪资范围和区间大小
    const minSalary = 0;
    const maxSalary = 460000;
    const binWidth = 20000;
    const binCount = Math.ceil((maxSalary - minSalary) / binWidth);

    const width = barSvg.attr('width');
    const height = barSvg.attr('height') - 30;
    const margin = { top: 50, right: 120, bottom: 50, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 清除现有内容
    barSvg.selectAll('*').remove();

    // 创建固定大小的bins
    const bins = Array.from({ length: binCount }, (_, i) => {
        const y0 = minSalary + (i * binWidth);
        const y1 = y0 + binWidth;
        return {
            y0: y0,
            y1: y1,
            EN: 0,
            MI: 0,
            SE: 0,
            EX: 0
        };
    });

    // 填充数据
    filteredData.forEach(d => {
        const binIndex = Math.floor((d.salary_in_usd - minSalary) / binWidth);
        if (binIndex >= 0 && binIndex < bins.length) {
            bins[binIndex][d.experience_level] += 1;
        }
    });

    // 准备堆叠数据
    const expLevels = ['EN', 'MI', 'SE', 'EX'];
    const stack = d3.stack().keys(expLevels);
    const stackedData = stack(bins);

    // 创建比例尺
    const x = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.EN + d.MI + d.SE + d.EX) || 10])
        .range([0, innerWidth])
        .nice();

    const y = d3.scaleLinear()
        .domain([minSalary, maxSalary])
        .range([innerHeight, 0]);

    const color = d3.scaleOrdinal()
        .domain(expLevels)
        .range(d3.schemeCategory10);

    // 创建主图形区域
    const g = barSvg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // 计算每个区间的高度
    const bandHeight = innerHeight / binCount;

    // 绘制堆叠条形图
    const barGroups = g.selectAll('.stack')
        .data(stackedData)
        .enter()
        .append('g')
        .attr('class', 'stack')
        .style('fill', d => color(d.key));
    let tooltip = d3.select('body').select('.salary-tooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('class', 'salary-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background-color', 'white')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('padding', '10px')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
            .style('pointer-events', 'none')
            .style('font-size', '12px')
            .style('z-index', 1000);
    }

    // 修改 bars 的事件处理
    const bars = barGroups.selectAll('rect')
        .data(d => d)
        .enter()
        .append('rect')
        .attr('x', d => x(d[0]))
        .attr('y', d => y(d.data.y1))
        .attr('height', d => y(d.data.y0) - y(d.data.y1))
        .attr('width', d => x(d[1] - d[0]))
        .style('cursor', 'pointer')
        .on('click', function (event, d) {
            // 获取当前薪资区间的数据
            const salaryMin = d.data.y0;
            const salaryMax = d.data.y1;
            const salaryRangeData = filteredData.filter(item =>
                item.salary_in_usd >= salaryMin &&
                item.salary_in_usd < salaryMax
            );

            showDetailModal(salaryRangeData);
        })
        .on('mouseover', function (event, d) {
            // 高亮显示所有具有相同 y 坐标的条形
            const currentY = y(d.data.y1);
            barGroups.selectAll('rect')
                .filter(function (data) {
                    return Math.abs(y(data.data.y1) - currentY) < 0.1;
                })
                .style('stroke', '#fff')
                .style('stroke-width', '2px');

            // 计算该薪资区间的统计信息
            const salaryRange = d.data;
            const total = expLevels.reduce((sum, level) => sum + salaryRange[level], 0);

            // 构建 tooltip 内容
            let tooltipContent = `
                    <strong>Salary Range: $${d3.format(",")(salaryRange.y0)} - $${d3.format(",")(salaryRange.y1)}</strong><br>
                    <br>
                    Total Count: ${total}<br>
                    <br>`;

            // 添加各经验等级的统计信息
            expLevels.forEach(level => {
                const count = salaryRange[level];
                const percentage = ((count / total) * 100).toFixed(1);
                const levelLabel = {
                    'EN': 'Entry Level',
                    'MI': 'Mid Level',
                    'SE': 'Senior',
                    'EX': 'Executive'
                }[level];
                tooltipContent += `${levelLabel}: ${count} (${percentage}%)<br>`;
            });

            // 显示 tooltip
            tooltip.html(tooltipContent)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px')
                .transition()
                .duration(200)
                .style('opacity', .9);
        })
        .on('mouseout', function () {
            // 移除高亮效果
            barGroups.selectAll('rect')
                .style('stroke', 'none')
                .style('stroke-width', '0');

            // 隐藏 tooltip
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        })
        .on('mousemove', function (event) {
            // 更新 tooltip 位置
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        });
    barGroups.selectAll('rect')
        .data(d => d)
        .enter()
        .append('rect')
        .attr('x', d => x(d[0]))
        .attr('y', d => y(d.data.y1))
        .attr('height', d => y(d.data.y0) - y(d.data.y1)) // 修改高度计算方式
        .attr('width', d => x(d[1] - d[0]))
        .append('title')
        .text(d => `Salary: ${d3.format(",")(d.data.y0)} - ${d3.format(",")(d.data.y1)}\nCount: ${d[1] - d[0]}`);


    // 添加坐标轴
    const xAxis = d3.axisBottom(x)
        .tickFormat(d => d);

    const yAxis = d3.axisLeft(y)
        .tickFormat(d => `${d3.format(",")(d)}`)
        .tickValues(d3.range(minSalary, maxSalary + binWidth, binWidth)); // 使用 binWidth 作为刻度间隔

    // 添加X轴
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

    // 添加Y轴
    g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis);

    // 添加轴标签
    g.append('text')
        .attr('class', 'x-label')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 40)
        .attr('text-anchor', 'middle')
        .text('Number of Employees');

    g.append('text')
        .attr('class', 'y-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -70)
        .attr('text-anchor', 'middle')
        .text('Salary (USD)');

    // 添加图例
    const legend = g.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${innerWidth - 160}, 0)`);

    const legendItems = legend.selectAll('.legend-item')
        .data(expLevels)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0,${i * 20})`);

    legendItems.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .style('fill', d => color(d));

    legendItems.append('text')
        .attr('x', 20)
        .attr('y', 12)
        .text(d => ({
            'EN': 'Entry Level',
            'MI': 'Mid Level',
            'SE': 'Senior',
            'EX': 'Executive'
        })[d]);

    // 添加标题
    barSvg.append('text')
        .attr('x', width / 2)
        .attr('y', margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Salary Distribution by Experience Level');
}


function updateMap() {
    // 创建国家代码映射对象 (ISO alpha-2 到数字代码的映射)
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    const countryCodeMap = {
        'AE': '784',  // United Arab Emirates
        'AL': '008',  // Albania
        'AM': '051',  // Armenia
        'AR': '032',  // Argentina
        'AS': '016',  // American Samoa
        'AT': '040',  // Austria
        'AU': '036',  // Australia
        'BA': '070',  // Bosnia and Herzegovina
        'BE': '056',  // Belgium
        'BO': '068',  // Bolivia
        'BR': '076',  // Brazil
        'BS': '044',  // Bahamas
        'CA': '124',  // Canada
        'CF': '140',  // Central African Republic
        'CH': '756',  // Switzerland
        'CL': '152',  // Chile
        'CN': '156',  // China
        'CO': '170',  // Colombia
        'CR': '188',  // Costa Rica
        'CZ': '203',  // Czech Republic
        'DE': '276',  // Germany
        'DK': '208',  // Denmark
        'DZ': '012',  // Algeria
        'EE': '233',  // Estonia
        'EG': '818',  // Egypt
        'ES': '724',  // Spain
        'FI': '246',  // Finland
        'FR': '250',  // France
        'GB': '826',  // United Kingdom
        'GH': '288',  // Ghana
        'GR': '300',  // Greece
        'HK': '344',  // Hong Kong
        'HN': '340',  // Honduras
        'HR': '191',  // Croatia
        'HU': '348',  // Hungary
        'ID': '360',  // Indonesia
        'IE': '372',  // Ireland
        'IL': '376',  // Israel
        'IN': '356',  // India
        'IQ': '368',  // Iraq
        'IR': '364',  // Iran
        'IT': '380',  // Italy
        'JP': '392',  // Japan
        'KE': '404',  // Kenya
        'LT': '440',  // Lithuania
        'LU': '442',  // Luxembourg
        'LV': '428',  // Latvia
        'MA': '504',  // Morocco
        'MD': '498',  // Moldova
        'MK': '807',  // North Macedonia
        'MT': '470',  // Malta
        'MX': '484',  // Mexico
        'MY': '458',  // Malaysia
        'NG': '566',  // Nigeria
        'NL': '528',  // Netherlands
        'NZ': '554',  // New Zealand
        'PH': '608',  // Philippines
        'PK': '586',  // Pakistan
        'PL': '616',  // Poland
        'PR': '630',  // Puerto Rico
        'PT': '620',  // Portugal
        'RO': '642',  // Romania
        'RU': '643',  // Russia
        'SE': '752',  // Sweden
        'SG': '702',  // Singapore
        'SI': '705',  // Slovenia
        'SK': '703',  // Slovakia
        'TH': '764',  // Thailand
        'TR': '792',  // Turkey
        'UA': '804',  // Ukraine
        'US': '840',  // United States
        'VN': '704',  // Vietnam
    };

    // Calculate average salary by country with code mapping
    const avgSalaryByCountry = d3.rollup(filteredData,
        v => d3.mean(v, d => d.salary_in_usd),
        d => countryCodeMap[d.company_location] || d.company_location
    );

    const countryStats = d3.rollup(filteredData,
        v => ({
            avgSalary: d3.mean(v, d => d.salary_in_usd),
            count: v.length
        }),
        d => countryCodeMap[d.company_location] || d.company_location
    );

    const salaryValues = Array.from(avgSalaryByCountry.values()).filter(v => !isNaN(v) && v > 0);
    const minSalary = d3.min(salaryValues);
    const maxSalary = d3.max(salaryValues);

    // 使用 scaleSequentialLog 替代普通的 scaleLog
    const colorScale = d3.scaleSequential()
        .domain([minSalary, maxSalary])
        .interpolator(d3.interpolateViridis)
        .clamp(true);

    // 添加调试信息
    // console.log("Salary range:", minSalary, maxSalary);
    // console.log("Sample color mappings:");
    // [0, 0.25, 0.5, 0.75, 1].forEach(t => {
    //     const value = Math.exp(Math.log(minSalary) * (1-t) + Math.log(maxSalary) * t);
    //     console.log(`${value}: ${colorScale(value)}`);
    // });

    // 更新地图颜色和交互部分的代码
    mapSvg.selectAll('.country')
        .transition()
        .duration(500)
        .style('fill', d => {
            const stats = countryStats.get(d.id);
            if (!stats || !stats.avgSalary || stats.avgSalary <= 0) {
                return '#ccc';
            }
            return colorScale(stats.avgSalary);
        });

    // 更新事件监听器
    mapSvg.selectAll('.country')
        .on('click', function (event, d) {
            const stats = countryStats.get(d.id);
            if (stats && stats.count > 0) {
                const countryData = filteredData.filter(item =>
                    countryCodeMap[item.company_location] === d.id
                );
                showCountryDetailModal(countryData, d.properties.name);
            }
        })
        .on('mouseover', function (event, d) {
            const stats = countryStats.get(d.id);
            d3.select(this)
                .style('stroke', '#fff')
                .style('stroke-width', '2px');

            tooltip.transition()
                .duration(200)
                .style('opacity', .9);

            let tooltipContent = `<strong>${d.properties.name}</strong><br>`;
            if (stats) {
                const avgSalary = stats.avgSalary.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0
                });
                tooltipContent += `Average Salary: ${avgSalary}<br>`;
                tooltipContent += `Sample Size: ${stats.count}`;
            } else {
                tooltipContent += 'No data available';
            }

            tooltip.html(tooltipContent)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function () {
            d3.select(this)
                .style('stroke', '#999')
                .style('stroke-width', '0.5px');

            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        })
        .on('mousemove', function (event) {
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        });

    createLegend(minSalary, maxSalary, colorScale);
}


function showDetailModal(data) {
    // 移除已存在的模态框
    d3.select('.detail-modal').remove();

    // 创建模态框，增加高度
    const modal = d3.select('body')
        .append('div')
        .attr('class', 'detail-modal')
        .style('position', 'fixed')
        .style('top', '50%')
        .style('left', '50%')
        .style('transform', 'translate(-50%, -50%)')
        .style('background', 'white')
        .style('padding', '20px')
        .style('border-radius', '8px')
        .style('box-shadow', '0 2px 10px rgba(0,0,0,0.1)')
        .style('z-index', 1000)
        .style('width', '800px')
        .style('height', '300px')
        .style('opacity', 0.95);

    // 添加关闭按钮
    modal.append('button')
        .style('position', 'absolute')
        .style('right', '10px')
        .style('top', '10px')
        .style('border', 'none')
        .style('background', 'none')
        .style('font-size', '20px')
        .style('cursor', 'pointer')
        .html('&times;')
        .on('click', () => modal.remove());

    const chartsContainer = modal.append('div')
        .style('display', 'flex')
        .style('justify-content', 'space-between')
        .style('margin-top', '20px');

    // 创建三个饼图
    createPieChart(chartsContainer, data, 'remote_ratio', 'Remote Work Distribution');
    createPieChart(chartsContainer, data, 'company_size', 'Company Size Distribution');
    createPieChart(chartsContainer, data, 'employment_type', 'Employment Type Distribution');
}

function createPieChart(container, data, field, title) {
    const width = 500;  // 增加宽度
    const height = 160; // 调整高度

    const svg = container.append('div')
        .style('margin-bottom', '10px')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // 添加标题
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(title);

    const pieWidth = 160; // 饼图的宽度
    const radius = pieWidth / 2;

    const g = svg.append('g')
        .attr('transform', `translate(${pieWidth / 2 + 30}, ${height / 2 + 10})`);

    // 计算数据
    const counts = d3.rollup(data, v => v.length, d => d[field]);
    const pieData = Array.from(counts, ([key, value]) => ({ key, value }));

    // 创建颜色比例尺
    const color = d3.scaleOrdinal()
        .domain(pieData.map(d => d.key))
        .range(d3.schemeCategory10);

    // 创建饼图生成器
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.6)
        .outerRadius(radius);

    // 绘制饼图
    const arcs = g.selectAll('path')
        .data(pie(pieData))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.key))
        .style('stroke', 'white')
        .style('stroke-width', '1px');

    // 添加标签
    const labelArc = d3.arc()
        .innerRadius(radius * 0.9)
        .outerRadius(radius * 0.9);

    g.selectAll('text.percentage')
        .data(pie(pieData))
        .enter()
        .append('text')
        .attr('class', 'percentage')
        .attr('transform', d => `translate(${labelArc.centroid(d)})`)
        .attr('dy', '.35em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', 'white')
        .text(d => {
            const percentage = ((d.data.value / data.length) * 100).toFixed(0);
            return percentage + '%';
        });

    // 添加图例，改为垂直排列
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${pieWidth + 80}, ${height / 2 - pieData.length * 12})`);

    const legendItems = legend.selectAll('.legend-item')
        .data(pieData)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 25})`); // 垂直间距

    legendItems.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .style('fill', d => color(d.key));

    // 添加图例文字（类别）
    legendItems.append('text')
        .attr('x', 20)
        .attr('y', 10)
        .style('font-size', '12px')
        .text(d => getLabelForKey(field, d.key));

    // 添加数值
    legendItems.append('text')
        .attr('x', 120)
        .attr('y', 10)
        .style('font-size', '12px')
        .text(d => {
            const percentage = ((d.value / data.length) * 100).toFixed(1);
            return `${d.value} (${percentage}%)`;
        });
}


function createPieChart(container, data, field, title) {
    const width = 220;
    const height = 300;  // 增加总高度

    // 定义各部分的尺寸和间距
    const margin = {
        top: 30,     // 顶部留白，容纳标题
        bottom: 100  // 底部留白，容纳图例
    };
    const radius = Math.min(width, height - margin.top - margin.bottom) / 2 - 5;  // 调整饼图半径

    const svg = container.append('div')
        .style('text-align', 'center')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // 添加标题，位于顶部居中
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', margin.top / 2)  // 标题垂直居中于顶部留白区域
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text(title);

    // 调整饼图位置，位于标题下方，图例上方
    const g = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${margin.top + radius + 10})`);

    // 计算数据
    const counts = d3.rollup(data, v => v.length, d => d[field]);
    const pieData = Array.from(counts, ([key, value]) => ({ key, value }));

    // 创建颜色比例尺
    const color = d3.scaleOrdinal()
        .domain(pieData.map(d => d.key))
        .range(d3.schemeCategory10);

    // 创建饼图生成器
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.6)
        .outerRadius(radius);

    // 绘制饼图
    const arcs = g.selectAll('path')
        .data(pie(pieData))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.key))
        .style('stroke', 'white')
        .style('stroke-width', '1px');

    // 添加垂直排列的图例，位于底部
    const legendY = height - margin.bottom + 10;  // 图例起始Y坐标
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width / 2 - 60}, ${legendY})`);

    const legendItems = legend.selectAll('.legend-item')
        .data(pieData)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 20})`);

    // 添加图例颜色方块
    legendItems.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .style('fill', d => color(d.key));

    // 添加图例文本
    legendItems.append('text')
        .attr('x', 15)
        .attr('y', 8)
        .style('font-size', '10px')
        .text(d => {
            const label = getLabelForKey(field, d.key);
            const percentage = ((d.value / data.length) * 100).toFixed(1);
            return `${label}: ${d.value} (${percentage}%)`;
        });
}



function getLabelForKey(field, key) {
    const labels = {
        remote_ratio: {
            0: 'No Remote',
            50: 'Hybrid',
            100: 'Remote'
        },
        company_size: {
            'S': 'Small',
            'M': 'Medium',
            'L': 'Large'
        },
        employment_type: {
            'PT': 'Part Time',
            'FT': 'Full Time',
            'CT': 'Contract'
        }
    };
    return labels[field][key] || key;
}

function showCountryDetailModal(data, countryName) {
    // 移除已存在的模态框
    d3.select('.detail-modal').remove();

    // 创建模态框
    const modal = d3.select('body')
        .append('div')
        .attr('class', 'detail-modal')
        .style('position', 'fixed')
        .style('top', '50%')
        .style('left', '50%')
        .style('transform', 'translate(-50%, -50%)')
        .style('background', 'white')
        .style('padding', '20px')
        .style('border-radius', '8px')
        .style('box-shadow', '0 2px 10px rgba(0,0,0,0.1)')
        .style('z-index', 1000)
        .style('width', '800px')
        .style('height', '520px')
        .style('opacity', 0.95);

    // 添加标题
    modal.append('h2')
        .style('text-align', 'center')
        .style('margin-top', '0')
        .text(`${countryName} - Salary Analysis`);

    // 添加关闭按钮
    modal.append('button')
        .style('position', 'absolute')
        .style('right', '10px')
        .style('top', '10px')
        .style('border', 'none')
        .style('background', 'none')
        .style('font-size', '20px')
        .style('cursor', 'pointer')
        .html('&times;')
        .on('click', () => modal.remove());

    // 创建饼图容器
    const chartsContainer = modal.append('div')
        .style('display', 'flex')
        .style('justify-content', 'space-between')
        .style('margin-top', '0px')
        .style('margin-bottom', '0px');

    // 创建三个饼图
    createPieChart(chartsContainer, data, 'remote_ratio', 'Remote Work Distribution');
    createPieChart(chartsContainer, data, 'company_size', 'Company Size Distribution');
    createPieChart(chartsContainer, data, 'employment_type', 'Employment Type Distribution');

    // 创建工作岗位薪资条形图
    const barContainer = modal.append('div')
        .style('margin-top', '0px')
        .style('width', '100%')
        .style('height', '200px');

    createJobSalaryChart(barContainer, data);
}

// 添加工作岗位薪资条形图函数
function createJobSalaryChart(container, data) {
    // 计算每个岗位的平均薪资
    const jobSalaries = Array.from(d3.rollup(data,
        v => ({
            avg_salary: d3.mean(v, d => d.salary_in_usd),
            count: v.length
        }),
        d => d.job_title
    )).map(([title, stats]) => ({
        title: title,
        salary: stats.avg_salary,
        count: stats.count
    }));

    // 按平均薪资排序并获取前5个
    const topJobs = jobSalaries
        .sort((a, b) => b.salary - a.salary)
        .slice(0, 5);

    // 设置图表尺寸
    const margin = { top: 30, right: 120, bottom: 40, left: 300 }; // 增加左边距和右边距
    const width = 800; // 增加总宽度
    const height = 200;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 创建SVG
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // 创建比例尺
    const x = d3.scaleLinear()
        .domain([0, d3.max(topJobs, d => d.salary)])
        .range([0, innerWidth]);

    const y = d3.scaleBand()
        .domain(topJobs.map(d => d.title))
        .range([0, innerHeight])
        .padding(0.1);

    // 添加横向条形
    g.selectAll('rect')
        .data(topJobs)
        .enter()
        .append('rect')
        .attr('y', d => y(d.title))
        .attr('height', y.bandwidth())
        .attr('x', 0)
        .attr('width', d => x(d.salary))
        .attr('fill', '#4682b4');

    // 添加薪资标签
    g.selectAll('.salary-label')
        .data(topJobs)
        .enter()
        .append('text')
        .attr('class', 'salary-label')
        .attr('y', d => y(d.title) + y.bandwidth() / 2)
        .attr('x', d => x(d.salary) + 5)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .text(d => d3.format('$,.0f')(d.salary));

    // 添加坐标轴
    g.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '12px')
        .style('text-anchor', 'end') // 确保文本右对齐
        .attr('dx', '-0.5em'); // 微调文本位置

    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x)
            .ticks(5)
            .tickFormat(d => d3.format('$,.0f')(d)))
        .selectAll('text')
        .style('font-size', '12px');

    // 根据职位数量动态设置标题
    const titleText = jobSalaries.length <= 5
        ? 'Job Salary Distribution'
        : 'Top 5 Job Titles by Average Salary';

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text(titleText);
}


