# 🚀 In-Memory Graph Database with Query Engine & Visualization

A lightweight, in-memory graph database built in JavaScript featuring a custom Gremlin-inspired query language and an interactive D3.js visualization layer.

---

## 🧠 Overview

This project implements a **graph database engine from scratch**, supporting:

- Dynamic node & edge storage  
- Query-based graph traversal  
- Pull-based execution pipeline  
- Real-time visualization with D3.js  

It demonstrates concepts across **data structures, system design, and frontend engineering**.

---

## ⚙️ Features

### 🔹 Graph Engine
- In-memory storage using adjacency lists
- Efficient node/edge insertion
- Bidirectional edge tracking (`_in`, `_out`)

### 🔹 Query Engine
- Custom Gremlin-like syntax:
  ```js
  g.v("Node0").out("next").property("name")