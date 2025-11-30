import React from "react";
import Filter from "./components/Filter";
import arrayListWords from "./data/list.json";
import "./App.css";

function App() {
  return (
    <div className="App">
      <Filter listWords={arrayListWords} />
    </div>
  );
}

export default App;
