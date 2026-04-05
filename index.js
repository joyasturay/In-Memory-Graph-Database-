class Graph {
  constructor() {
    this.vertices = [];
    this.edges = [];
    this.autoid = 1;
  }

  addVertex(v) {
    v._id = this.autoid++;
    v._out = [];
    v._in = [];
    this.vertices.push(v);
  }

  addEdge(e) {
    const from = this.vertices.find((v) => v._id === e._out);
    const to = this.vertices.find((v) => v._id === e._in);

    if (!from || !to) return;

    const edge = { ...e, _out: from, _in: to };
    from._out.push(edge);
    to._in.push(edge);
    this.edges.push(edge);
  }

  v(...args) {
    const query = new Query(this);
    return query.v(...args);
  }
}

// --- THE PIPE FACTORIES ---

function makeVertexPipe(graph, args) {
  let index = 0;
  let startingNodes = [];
  const searchName = args[0] ? args[0].trim().toLowerCase() : "";
  const startNode = graph.vertices.find(
    (v) => v.name.toLowerCase() === searchName,
  );
  if (startNode) startingNodes.push(startNode);

  return {
    pull: function () {
      if (index < startingNodes.length) {
        let node = startingNodes[index++];
        return { vertex: node, state: {}, result: node };
      }
      return false;
    },
  };
}

function makeOutPipe(previousPipe, args) {
  const label = args[0];
  let currentGremlin = false;
  let edgesToProcess = [];
  let edgeIndex = 0;

  return {
    pull: function () {
      while (true) {
        if (edgeIndex < edgesToProcess.length) {
          let edge = edgesToProcess[edgeIndex++];
          if (!label || edge.label === label) {
            return {
              vertex: edge._in,
              state: currentGremlin.state,
              result: edge._in,
            };
          }
          continue;
        }
        currentGremlin = previousPipe.pull();
        if (!currentGremlin) return false;
        edgesToProcess = currentGremlin.vertex._out;
        edgeIndex = 0;
      }
    },
  };
}

function makeInPipe(previousPipe, args) {
  const label = args[0];
  let currentGremlin = false;
  let edgesToProcess = [];
  let edgeIndex = 0;

  return {
    pull: function () {
      while (true) {
        if (edgeIndex < edgesToProcess.length) {
          let edge = edgesToProcess[edgeIndex++];
          if (!label || edge.label === label) {
            return {
              vertex: edge._out,
              state: currentGremlin.state,
              result: edge._out,
            };
          }
          continue;
        }
        currentGremlin = previousPipe.pull();
        if (!currentGremlin) return false;
        edgesToProcess = currentGremlin.vertex._in;
        edgeIndex = 0;
      }
    },
  };
}

function makePropertyPipe(previousPipe, args) {
  const propName = args[0];
  return {
    pull: function () {
      let gremlin;
      while ((gremlin = previousPipe.pull())) {
        if (gremlin.vertex[propName]) {
          gremlin.result = gremlin.vertex[propName];
          return gremlin;
        }
      }
      return false;
    },
  };
}

class Query {
  constructor(graph) {
    this.graph = graph;
    this.program = [];
  }

  v(...args) {
    this.program.push(makeVertexPipe(this.graph, args));
    return this;
  }

  out(...args) {
    const prevPipe = this.program[this.program.length - 1];
    this.program.push(makeOutPipe(prevPipe, args));
    return this;
  }

  in(...args) {
    const prevPipe = this.program[this.program.length - 1];
    this.program.push(makeInPipe(prevPipe, args));
    return this;
  }

  property(...args) {
    const prevPipe = this.program[this.program.length - 1];
    this.program.push(makePropertyPipe(prevPipe, args));
    return this;
  }

  run() {
    let max = 100; // Safety net
    let results = [];
    let lastPipe = this.program[this.program.length - 1];
    let maybe_gremlin;

    while (max-- && (maybe_gremlin = lastPipe.pull())) {
      results.push(maybe_gremlin.result);
    }

    return results;
  }
}
const g = new Graph();
for (let i = 0; i < 500; i++) {
  g.addVertex({ name: `Node${i}` });

  if (i > 0) {
    g.addEdge({ _out: i - 1, _in: i, label: "next" });
  }
}

g.addEdge({ _out: 0, _in: 15, label: "branch" });
g.addEdge({ _out: 15, _in: 45, label: "branch" });
g.addEdge({ _out: 45, _in: 3, label: "branch" });

function executeQuery() {
  const start = document.getElementById("startNode").value;
  const cmd = document.getElementById("commands").value;
  const outputBox = document.getElementById("output");

  let result = [];

  try {
    result = eval(`g.v('${start}')${cmd}.run()`);
    outputBox.innerText = JSON.stringify(result, null, 2);
  } catch (e) {
    outputBox.innerText = "Error: " + e.message;
  }
  drawGraph(result);
}

function getGraphData() {
  return {
    nodes: g.vertices.map((v) => ({ id: v._id, name: v.name })),
    links: g.edges.map((e) => ({
      source: e._out._id,
      target: e._in._id,
    })),
  };
}

function drawGraph(highlightedNames = []) {
  const { nodes, links } = getGraphData();
  const svg = d3.select("#graph");
  svg.selectAll("*").remove();

  const width = document.getElementById("graph").clientWidth;
  const height = document.getElementById("graph").clientHeight || 600;

  const g_container = svg.append("g");

  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
      g_container.attr("transform", event.transform);
    });

  svg.call(zoom);

  svg
    .append("defs")
    .append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "-0 -5 10 10")
    .attr("refX", 20)
    .attr("refY", 0)
    .attr("orient", "auto")
    .attr("markerWidth", 5)
    .attr("markerHeight", 5)
    .attr("xoverflow", "visible")
    .append("svg:path")
    .attr("d", "M 0,-5 L 10 ,0 L 0,5")
    .attr("fill", "#666")
    .style("stroke", "none");

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(50),
    )
    .force("charge", d3.forceManyBody().strength(-150))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const link = g_container
    .append("g")
    .selectAll("line")
    .data(links)
    .enter()
    .append("line")
    .style("stroke", "#666")
    .style("stroke-width", 1.5)
    .attr("marker-end", "url(#arrowhead)");

  const node = g_container
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .enter()
    .append("circle")
    .attr("r", (d) => (highlightedNames.includes(d.name) ? 25 : 8))
    .style("fill", (d) =>
      highlightedNames.includes(d.name) ? "#ff9800" : "#4CAF50",
    )
    .style("stroke", (d) =>
      highlightedNames.includes(d.name) ? "#fff" : "none",
    )
    .style("stroke-width", 3);

  const text = g_container
    .append("g")
    .selectAll("text")
    .data(nodes)
    .enter()
    .append("text")
    .text((d) => d.name)
    .attr("fill", (d) =>
      highlightedNames.includes(d.name) ? "#ff9800" : "#aaa",
    )
    .style("opacity", (d) =>
      highlightedNames.includes(d.name) || d.name === "Node0" ? 1 : 0.2,
    )
    .attr("font-size", (d) => (highlightedNames.includes(d.name) ? 20 : 10))
    .attr("dx", 12)
    .attr("dy", 4);

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

    text.attr("x", (d) => d.x).attr("y", (d) => d.y);
  });
}

drawGraph();
