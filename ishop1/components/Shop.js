import React from "react";

import "./Shop.css";

import ShopCaption from "./ShopCaption";
import Product from "./Product";

class Shop extends React.Component {
  render() {
    const answersCodeForProduct = this.props.answers.map((v) => (
      <Product
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
        <thead>
          <tr>
            <th>Название товара</th>
            <th>Цена товара</th>
            <th>Остаток на складе</th>
            <th>Изображение</th>
          </tr>
        </thead>
        <tbody>{answersCodeForProduct}</tbody>
      </table>
    );
  }
}

export default Shop;
