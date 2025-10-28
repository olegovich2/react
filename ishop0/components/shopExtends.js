import React from "react";

import "./style.css";

class Shop extends React.Component {
  render() {
    return (
      <div className="Shop">
        <span className="Shop_Text">{this.props.name}</span>
        <br></br>
        <span className="storeAddress">{this.props.storeAddress}</span>
      </div>
    );
  }
}

export default Shop;
