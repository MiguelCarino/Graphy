// Determine which JSON file to load based on the URL hash
const defaultJson = "assets/json/graph.json"; // Default JSON file
const hash = window.location.hash.substring(1); // Get the hash from the URL
const jsonFile = hash ? `assets/json/${hash}.json` : defaultJson; // Construct JSON filename

fetch(jsonFile)
    .then(response => {
        if (!response.ok) throw new Error(`Failed to load JSON: ${jsonFile}`);
        return response.json();
    })
    .then(rawData => {
        console.log(`Loaded JSON file: ${jsonFile}`);
        // Update the header dynamically
        if (rawData.header) {
            const { title, description } = rawData.header;
            document.getElementById("title").textContent = title || "Dynamic Graph";
            document.getElementById("description").textContent = description || "Explore dynamic relationships.";
        }
        const data = { nodes: [], links: [] };
        const customNodes = {}; // To track custom nodes for toggle functionality

        // Populate nodes and links from JSON
        rawData.nodes.forEach(node => {
            data.nodes.push(node);
            node.targets.forEach(target => {
                data.links.push({ source: node.id, target });
            });
        });

        const width = window.innerWidth;
        const height = window.innerHeight - 120;

        // Create SVG canvas
        const svg = d3.select("#chart")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(d3.zoom()
                .scaleExtent([0.5, 5]) // Zoom limits
                .on("zoom", (event) => svgGroup.attr("transform", event.transform))
            )
            .append("g");

        const svgGroup = svg.append("g");

        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2));

        // Draw links
        let link = svgGroup.selectAll("line")
            .data(data.links)
            .enter()
            .append("line")
            .attr("stroke", "#999")
            .attr("stroke-width", 1);

        // Draw nodes
        let node = svgGroup.selectAll("circle")
            .data(data.nodes)
            .enter()
            .append("circle")
            .attr("r", 14)
            .attr("fill", d => d3.schemeCategory10[d.group % 10])
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on("click", (_, d) => highlightConnections(d.id));

        // Add labels
        let labels = svgGroup.selectAll("text")
            .data(data.nodes)
            .enter()
            .append("text")
            .text(d => d.id)
            .attr("font-size", 20)
            .attr("fill", "#fff")
            .attr("cursor", d => d.link ? "pointer" : "default")
            .on("click", (_, d) => {
                if (d.link) window.open(d.link, "_blank");
            });

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("cx", d => d.x).attr("cy", d => d.y);

            labels
                .attr("x", d => d.x + 12)
                .attr("y", d => d.y + 3);
        });

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        function highlightConnections(nodeId) {
            console.log(`Highlighting connections for node "${nodeId}".`);
            link.attr("stroke", l =>
                l.source.id === nodeId || l.target.id === nodeId ? "#ffcc00" : "#999"
            );
            node.attr("fill", n =>
                n.id === nodeId || data.links.some(l => (l.source.id === nodeId && l.target.id === n.id) || (l.target.id === nodeId && l.source.id === n.id))
                    ? "#ffcc00"
                    : d3.schemeCategory10[n.group % 10]
            );        
        
            // Automatically zoom to the node
            const highlightedNode = data.nodes.find(n => n.id === nodeId);
            if (highlightedNode) {
                const transform = d3.zoomIdentity
                    .translate(width / 2, height / 2)
                    .scale(2)
                    .translate(-highlightedNode.x, -highlightedNode.y);
                svg.transition().duration(750).call(d3.zoom().transform, transform);
            }
        }
        

        // Add buttons dynamically for customNodes
        const buttonsContainer = document.getElementById("buttons");
        Object.keys(rawData.customNodes).forEach(key => {
            const button = document.createElement("button");
            button.innerText = key;
            button.onclick = () => toggleCustomNode(key);
            buttonsContainer.appendChild(button);
        });

        function toggleCustomNode(nodeId) {
            if (customNodes[nodeId]) {
                // If the custom node exists, remove it
                removeCustomNode(nodeId);
            } else {
                // Otherwise, create the custom node
                createCustomNode(nodeId);
            }
        }

        function createCustomNode(nodeId) {
            const linkedNodes = rawData.customNodes[nodeId];
            if (!linkedNodes) {
                console.error(`No linked nodes found for custom node: ${nodeId}`);
                return;
            }
        
            // Check if the node already exists
            if (data.nodes.some(node => node.id === nodeId)) {
                console.warn(`Custom node "${nodeId}" already exists.`);
                return;
            }
        
            // Create the custom node
            const newNode = { id: nodeId, group: 4, targets: linkedNodes };
            data.nodes.push(newNode);
        
            // Add links to the custom node
            linkedNodes.forEach(target => {
                data.links.push({ source: nodeId, target });
            });
        
            console.log(`Created custom node "${nodeId}".`);
            console.log("Updated nodes:", data.nodes);
            console.log("Updated links:", data.links);
        
            customNodes[nodeId] = true;
        
            // Update the graph
            update();
        }
        

        function removeCustomNode(nodeId) {
            // Remove the custom node from the data
            data.nodes = data.nodes.filter(node => node.id !== nodeId);
        
            // Remove all links connected to the custom node
            data.links = data.links.filter(link => link.source.id !== nodeId && link.target.id !== nodeId);
        
            // Remove the custom node from the tracker
            delete customNodes[nodeId];
        
            console.log(`Removed custom node "${nodeId}".`);
            console.log("Updated nodes:", data.nodes);
            console.log("Updated links:", data.links);
        
            // Update the graph
            update();
        }
        

        function update() {
            // Update links
            link = link.data(data.links, d => `${d.source.id}-${d.target.id}`);
            console.log("Updating links:", link.size());
            link.exit().remove(); // Remove unused links from the DOM
            link = link.enter()
                .append("line")
                .attr("stroke", "#999")
                .attr("stroke-width", 1)
                .merge(link);
        
            // Update nodes
            node = node.data(data.nodes, d => d.id);
            console.log("Updating nodes:", node.size());
            node.exit().remove(); // Remove unused nodes from the DOM
            node = node.enter()
                .append("circle")
                .attr("r", 14)
                .attr("fill", d => d3.schemeCategory10[d.group % 10])
                .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended))
                .on("click", (_, d) => highlightConnections(d.id))
                .merge(node);
        
            // Update labels
            labels = labels.data(data.nodes, d => d.id);
            console.log("Updating labels:", labels.size());
            labels.exit().remove(); // Remove unused labels from the DOM
            labels = labels.enter()
                .append("text")
                .text(d => d.id)
                .attr("font-size", 20)
                .attr("fill", "#fff")
                .attr("cursor", d => d.link ? "pointer" : "default")
                .on("click", (_, d) => {
                    if (d.link) window.open(d.link, "_blank");
                })
                .merge(labels);
        
            // Restart the simulation
            simulation.nodes(data.nodes);
            simulation.force("link").links(data.links);
            simulation.alpha(1).restart();
        }        
        
    });
    window.addEventListener("hashchange", () => {
        location.reload();
    });
    