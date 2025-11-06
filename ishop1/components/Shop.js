import React from "react";

import "./Shop.css";

import ShopCaption from "./ShopCaption";
import TitleColumns from "./TitleColumns";
import Product from "./Product";

class Shop extends React.Component {
  render() {
    const answersCode = this.props.answers.map((v) => (
      <TitleColumns
        isLink={v.isLink}
        key={v.code}
        name={v.name}
        price={v.price}
        residual={v.residual}
        url={v.url}
      />
    ));
    const answersCodeForTbody = this.props.answers.map((v) => (
      <Product
        isLink={v.isLink}
        key={v.code}
        name={v.name}
        price={v.price}
        residual={v.residual}
        url={v.url}
      />
    ));
    return (
      <table>
        <ShopCaption caption={this.props.caption} />
        <thead>{answersCode}</thead>
        <tbody>{answersCodeForTbody}</tbody>
      </table>
    );
  }
}

export default Shop;
