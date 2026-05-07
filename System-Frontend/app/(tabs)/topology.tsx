import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Alert, SafeAreaView, Text, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { BACKEND_URL } from '../../constants/config';
import { BlinkingCursor } from '../../components/ui';

// Conditionally import WebView only for native
let WebView: any = null;
try {
  if (Platform.OS !== 'web') {
    WebView = require('react-native-webview').WebView;
  }
} catch (e) {
  // WebView not available on this platform
  console.warn('WebView not available on this platform');
}

interface Node {
  id: string;
  group: number;
  val: number;
  color: string;
  label: string;
}

interface Link {
  source: string;
  target: string;
  value: number;
}

interface TopologyData {
  nodes: Node[];
  links: Link[];
  total_nodes: number;
  total_links: number;
}

export default function TopologyScreen() {
  const { user } = useAuth();
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlString, setHtmlString] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const handleGraphMessage = useCallback((rawData: string) => {
    try {
      const payload = JSON.parse(rawData);
      if (payload.action === 'NODE_CLICK') {
        const nodeData = payload.data as Node;
        setSelectedNode(nodeData);
        console.log('✓ NODE_SELECTED:', nodeData.id, nodeData.label);
        // Optional: Add routing logic here based on node type
        if (Platform.OS !== 'web') {
          Alert.alert('NODE_SELECTED', `${nodeData.label} (${nodeData.id})`);
        }
      }
    } catch (e) {
      console.error('Message parse error', e);
    }
  }, []);

  const generateHTML = useCallback((data: TopologyData) => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Neural Topology</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: #000000;
      overflow: hidden;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    }
    svg {
      width: 100%;
      height: 100%;
      background: #000000;
      display: block;
      pointer-events: all;
      touch-action: none;
    }
    .link { stroke: #1a1a1a; stroke-width: 1px; pointer-events: none; }
    .node circle { cursor: pointer; stroke-width: 1.5px; pointer-events: auto; }
    .node text { font-size: 11px; font-weight: bold; pointer-events: none; text-anchor: middle; }
    .node circle.selected { filter: drop-shadow(0 0 8px currentColor); }
    .graph-controls {
      position: fixed; top: 16px; left: 16px; background: #0a0a0a; border: 2px solid #1a1a1a;
      padding: 12px; border-radius: 4px; font-size: 12px; color: #00FF66; z-index: 1000;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace; letter-spacing: 1px;
    }
    .stat-line { margin: 4px 0; text-align: left; }
  </style>
</head>
<body>
  <svg id="graph"></svg>
  <div class="graph-controls">
    <div class="stat-line">NODES: ${data.total_nodes}</div>
    <div class="stat-line">LINKS: ${data.total_links}</div>
    <div class="stat-line">──────────────</div>
    <div class="stat-line">TOPOLOGY_ACTIVE</div>
  </div>
  <script>
    const nodes = ${JSON.stringify(data.nodes)};
    const links = ${JSON.stringify(data.links)};
    const width = window.innerWidth;
    const height = window.innerHeight;
    const svg = d3.select('#graph').attr('width', width).attr('height', height);
    const g = svg.append('g');
    
    let selectedNode = null;
    
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(50).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(d => Math.sqrt(d.val) * 3 + 5));
    
    const drag = d3.drag()
      .on('start', d => { if (!d3.event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', d => { d.fx = d3.event.x; d.fy = d3.event.y; })
      .on('end', d => { if (!d3.event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });
    
    g.selectAll('.link').data(links).enter().append('line').attr('class', 'link').attr('stroke', '#1a1a1a');
    
    const node = g.selectAll('.node').data(nodes).enter().append('g').attr('class', 'node');
    
    const circles = node.append('circle')
      .attr('r', d => Math.sqrt(d.val) * 2)
      .attr('fill', d => d.color)
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5)
      .style('pointer-events', 'auto');
    
    node.append('text')
      .attr('dy', d => -Math.sqrt(d.val) * 2 - 8)
      .attr('fill', d => d.color)
      .text(d => d.label)
      .style('pointer-events', 'none');
    
    // Apply drag ONLY after setting up click handlers
    node.call(drag);
    
    // ===== NODE CLICK SELECTION (HIGHEST PRIORITY) =====
    circles.on('click', function(event, d) {
      event.stopPropagation();
      event.preventDefault();
      
      console.log('CLICK_RECEIVED:', d.id);
      
      // Deselect if clicking same node
      if (selectedNode && selectedNode.id === d.id) {
        circles.attr('stroke', '#333').attr('stroke-width', 1.5).attr('opacity', 1);
        g.selectAll('.link').attr('stroke', '#1a1a1a').attr('opacity', 0.3);
        node.selectAll('text').attr('opacity', 1);
        selectedNode = null;
        console.log('NODE_DESELECTED:', d.id);
        return;
      }
      
      // Deselect all previous nodes
      circles.attr('stroke', '#333').attr('stroke-width', 1.5);
      
      // Select new node with NEON GREEN STROKE
      d3.select(this)
        .attr('stroke', '#00FF66')
        .attr('stroke-width', 4);
      
      selectedNode = d;
      console.log('NODE_SELECTED:', d.id, d.label);
      
      // ===== FOCUS: Find connected nodes (sources and targets) =====
      const connectedNodeIds = new Set([d.id]);
      links.forEach(link => {
        if (link.source.id === d.id) connectedNodeIds.add(link.target.id);
        if (link.target.id === d.id) connectedNodeIds.add(link.source.id);
      });
      
      console.log('CONNECTED_NODES:', Array.from(connectedNodeIds));
      
      // ===== DIM non-connected nodes, HIGHLIGHT connected nodes =====
      circles.attr('opacity', node_d => {
        return connectedNodeIds.has(node_d.id) ? 1 : 0.2;
      })
      .attr('stroke', node_d => {
        if (node_d.id === d.id) return '#00FF66';
        if (connectedNodeIds.has(node_d.id)) return '#FFFFFF';
        return '#333';
      })
      .attr('stroke-width', node_d => {
        if (node_d.id === d.id) return 4;
        if (connectedNodeIds.has(node_d.id)) return 2;
        return 1.5;
      });
      
      // Highlight connecting links
      g.selectAll('.link').attr('opacity', link_d => {
        if (link_d.source.id === d.id || link_d.target.id === d.id) return 1;
        return 0.05;
      })
      .attr('stroke', link_d => {
        if (link_d.source.id === d.id || link_d.target.id === d.id) return '#00FF66';
        return '#1a1a1a';
      })
      .attr('stroke-width', link_d => {
        if (link_d.source.id === d.id || link_d.target.id === d.id) return 2;
        return 1;
      });
      
      // Dim labels of non-connected nodes
      node.selectAll('text').attr('opacity', node_d => {
        return connectedNodeIds.has(node_d.id) ? 1 : 0.2;
      });
      
      // ===== ANIMATE: Zoom & Pan to selected node =====
      const k = 3; // Zoom level (how close to zoom in)
      const x = d.x || 0;
      const y = d.y || 0;
      const transform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(k)
        .translate(-x, -y);
      
      svg.transition()
        .duration(800)
        .call(zoomBehavior.transform, transform);
      
      console.log('ANIMATING_TO_NODE:', d.id, 'x:', x, 'y:', y);
      
      // Send message to React Native (if WebView)
      if (window.ReactNativeWebView) {
        const nodeData = {
          action: 'NODE_CLICK',
          data: {
            id: d.id,
            label: d.label,
            color: d.color,
            group: d.group,
            val: d.val,
            connected_nodes: Array.from(connectedNodeIds)
          }
        };
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(nodeData));
          console.log('MESSAGE_SENT_TO_REACT');
        } catch (err) {
          console.error('Failed to send message:', err);
        }
      }
    });
    
    // ===== BACKGROUND CLICK TO DESELECT =====
    svg.on('click', function(event) {
      if (event.target.tagName === 'svg') {
        // Reset all nodes to default
        circles.attr('stroke', '#333').attr('stroke-width', 1.5).attr('opacity', 1);
        g.selectAll('.link').attr('stroke', '#1a1a1a').attr('opacity', 0.3).attr('stroke-width', 1);
        node.selectAll('text').attr('opacity', 1);
        selectedNode = null;
        
        // Zoom out to full view with animation
        svg.transition()
          .duration(800)
          .call(zoomBehavior.transform, d3.zoomIdentity.translate(0, 0));
        
        console.log('GRAPH_DESELECT_RESET');
      }
    });
    
    // Attach zoom with filter to NOT trigger on circle clicks
    const zoomBehavior = d3.zoom()
      .filter(function(event) {
        // Allow zoom on svg background, but NOT on nodes
        if (event.target.tagName === 'circle') {
          return false;
        }
        return !event.button; // Ignore right-click
      })
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoomBehavior);
    
    // Prevent browser default zoom behavior on desktop
    svg.on('wheel', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });
    
    // Also prevent pinch zoom on mobile if needed
    document.addEventListener('gesturestart', e => e.preventDefault());
    
    simulation.on('tick', () => {
      g.selectAll('.link')
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      g.selectAll('.node').attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
    });
    
    window.addEventListener('resize', () => {
      const nw = window.innerWidth, nh = window.innerHeight;
      svg.attr('width', nw).attr('height', nh);
      simulation.force('center', d3.forceCenter(nw / 2, nh / 2));
    });
  </script>
</body>
</html>`;
    return html;
  }, []);

  const loadTopology = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/network/topology?user_id=${user.id}`);
      const data = await res.json();
      
      if (data.success) {
        setTopology(data);
        const html = generateHTML(data);
        setHtmlString(html);
      } else {
        setError(data.error || 'Failed to load topology');
        Alert.alert('TOPOLOGY_ERR', data.error || 'Failed to load neural matrix topology.');
      }
    } catch (e: any) {
      console.error("Topology load error", e);
      setError(e.message);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, generateHTML]);

  useFocusEffect(
    useCallback(() => {
      loadTopology();
    }, [loadTopology])
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <BlinkingCursor />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        ) : Platform.OS === 'web' ? (
          // Web: Use iframe for proper HTML/JS execution
          <iframe
            srcDoc={htmlString}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: '#000',
            }}
          />
        ) : htmlString ? (
          // Native: Use WebView
          <WebView
            originWhitelist={['*']}
            source={{ html: htmlString }}
            style={styles.webview}
            scalesPageToFit={true}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={(event) => handleGraphMessage(event.nativeEvent.data)}
          />
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 16,
  },
  errorBox: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#FF2C55',
    padding: 16,
    borderRadius: 4,
  },
  errorText: {
    color: '#FF2C55',
    fontFamily: 'Courier New',
    fontSize: 12,
    textAlign: 'center',
  },
  webNotSupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 16,
  },
  webNotSupportedText: {
    color: '#00FF66',
    fontFamily: 'Courier New',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 2,
  },
  webNotSupportedSubtext: {
    color: '#FFFFFF',
    fontFamily: 'Courier New',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  webNotSupportedInfo: {
    color: '#888',
    fontFamily: 'Courier New',
    fontSize: 11,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
});
