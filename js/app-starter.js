async function main() {
  const app = d3.select('#app');

  // Tooltip
  const tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'd3-tooltip');

  // loading data...
  const [rawMovies, rawShows] = await Promise.all([
    d3.csv('./data/NetflixMovies_added.csv'),
    d3.csv('./data/NetflixTV_added.csv')
  ]);

  function parseGenres(genres) {
    if (!genres || genres.trim() === '') return ['Unspecified'];
    const parsed = genres
      .split(',')
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
    return parsed.length > 0 ? parsed : ['Unspecified'];
  }

  // movies
  const movies = rawMovies.flatMap((d) => {
    const views = +(d.Views || d.views || 0);
    const genres = parseGenres(d.genres || d.Genre);
    return genres.map((genre) => ({
      type: 'Movie',
      genre: genre,
      views: views
    }));
  });

  // Series
  const shows = rawShows.flatMap((d) => {
    const views = +(d.Views || d.views || 0);
    const genres = parseGenres(d.genres || d.Genre);
    return genres.map((genre) => ({
      type: 'Serie',
      genre: genre,
      views: views
    }));
  });

  const allData = [...movies, ...shows];

  // function for the treemap
  function renderChart(filterType) {
    // Limpiar visualización anterior
    app.selectAll('svg').remove();

    // which data im going to use
    let dataToUse = allData;
    if (filterType === 'movies') dataToUse = movies;
    if (filterType === 'series') dataToUse = shows;

    // group data
    const rolledData = d3.rollup(
      dataToUse,
      (v) => d3.sum(v, (d) => d.views),
      (d) => d.type,
      (d) => d.genre
    );

    const hierarchyData = d3
      .hierarchy(rolledData)
      .sum((d) => (typeof d[1] === 'number' ? d[1] : 0))
      .sort((a, b) => b.value - a.value);

    const width = 800;
    const height = 560;

    const treemapLayout = d3
      .treemap()
      .size([width, height - 110])
      .paddingOuter(4)
      .paddingTop(22)
      .paddingInner(2);

    treemapLayout(hierarchyData);

    const maxViews = d3.max(
      hierarchyData.descendants().filter((d) => d.depth === 2),
      (d) => d.value
    );

    const colorScale = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, Math.sqrt(maxViews)]);

    //  SVG
    const svg = d3
      .create('svg')
      .attr('viewBox', [0, 0, width, height])
      .style('font-family', 'Montserrat, sans-serif')
      .style('background-color', '#000000');

    // Main title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 22)
      .attr('text-anchor', 'middle')
      .style('font-size', '17px')
      .style('font-weight', '700')
      .style('fill', '#fcfcfc')
      .text('¿What Genres dominate Netflix views?');

    const chartGroup = svg
      .append('g')
      .attr('transform', 'translate(0, 30)');

    // Dibujar nodos
    const nodes = chartGroup
      .selectAll('g')
      .data(hierarchyData.descendants().filter((d) => d.depth === 2))
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    nodes
      .append('rect')
      .attr('width', (d) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d) => Math.max(0, d.y1 - d.y0))
      .attr('fill', (d) => colorScale(Math.sqrt(d.value)))
      .attr('opacity', 0.9)
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke', '#fcfcfc').attr('stroke-width', 1.5);
        tooltip.style('opacity', 1).html(`
          <div style="font-weight: 700; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
            ${d.parent.data[0]} — ${d.data[0]}
          </div>
          <div>Total Views: <b>${d3.format(',.0f')(d.value)}</b></div>
        `);
      })
      .on('mousemove', function (event) {
        tooltip
          .style('left', event.pageX + 15 + 'px')
          .style('top', event.pageY - 30 + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.9).attr('stroke', 'none');
        tooltip.style('opacity', 0);
      });

    // Etiquetas de texto dentro de los rectángulos
    nodes
      .append('text')
      .attr('x', 4)
      .attr('y', 12) 
      .style('font-weight', '600')
      .style('fill', (d) =>
        Math.sqrt(d.value) > Math.sqrt(maxViews) / 1.8 ? '#ffffff' : '#ffffff'
      )
      .style('pointer-events', 'none')
      .style('font-size', (d) => {
        const w = d.x1 - d.x0;
        const wordLength = d.data[0].length;
        // Aproximamos que cada letra ocupa el 60% del tamaño de la fuente
        let calcSize = (w - 10) / (0.9 * wordLength);
        // Restringimos la fuente para que no sea menor de 7.5px ni mayor de 14px
        calcSize = Math.max(4.5, Math.min(14, calcSize)); 
        return `${calcSize}px`;
      })
      .text((d) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        const wordLength = d.data[0].length;
      
        const minWidthRequired = (wordLength * 2.5) + 10; 
        
        // if the box is too small no name will appear 
        return w > minWidthRequired && h > 18 ? d.data[0] : '';
      });

    //  MOVIES / SERIES 
    chartGroup
      .selectAll('.group-label')
      .data(hierarchyData.descendants().filter((d) => d.depth === 1))
      .join('text')
      .attr('x', (d) => d.x0 + 6)
      .attr('y', (d) => d.y0 + 15)
      .style('font-size', '12px')
      .style('font-weight', '700')
      .style('fill', '#fcfcfc')
      .text((d) => `${d.data[0].toUpperCase()}S`);

    // ---  Key ---
    const legendWidth = 240;
    const legendHeight = 8;
    const legendX = (width - legendWidth) / 2;
    const legendY = height - 40;

    const defs = svg.append('defs');
    const linearGradient = defs
      .append('linearGradient')
      .attr('id', 'views-gradient');

    const stops = 10;
    for (let i = 0; i <= stops; i++) {
      const offset = i / stops;
      const value = Math.pow(offset, 2) * maxViews;
      linearGradient
        .append('stop')
        .attr('offset', `${offset * 100}%`)
        .attr('stop-color', colorScale(Math.sqrt(value)));
    }

    const legendGroup = svg
      .append('g')
      .attr('transform', `translate(${legendX}, ${legendY})`);

    legendGroup
      .append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#views-gradient)')
      .attr('rx', 2);

    legendGroup
      .append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', '600')
      .style('fill', '#cbd5e1')
      .text('Views per Genre');

    const formatMillions = (val) => {
      if (val === 0) return '0M';
      return Math.round(val / 1e6) + 'M';
    };

    const legendTicks = [0, maxViews / 2, maxViews];

    legendGroup
      .selectAll('.legend-tick')
      .data(legendTicks)
      .join('text')
      .attr('x', (d, i) => (i / 2) * legendWidth)
      .attr('y', legendHeight + 14)
      .attr('text-anchor', (d, i) => (i === 0 ? 'start' : i === 2 ? 'end' : 'middle'))
      .style('font-size', '9px')
      .style('fill', '#94a3b8')
      .text((d) => formatMillions(d));

    // Fuente
    svg
      .append('text')
      .attr('x', 10)
      .attr('y', height - 10)
      .style('font-size', '9px')
      .style('fill', '#f4f5f6')
      .style('GillSans', 'italic')
      .text('Source: Netflix Engagement Dataset');

    // Añadir al DOM
    app.append(() => svg.node());
  }

  // --- Lógica de Interacción de Botones ---
  
  // Renderizar estado inicial
  renderChart('movies');

  const buttons = d3.selectAll('#controls button');

  d3.select('#btn-movies').on('click', function() {
    buttons.classed('active', false);
    d3.select(this).classed('active', true);
    renderChart('movies');
  });

  d3.select('#btn-series').on('click', function() {
    buttons.classed('active', false);
    d3.select(this).classed('active', true);
    renderChart('series');
  });


}

main();