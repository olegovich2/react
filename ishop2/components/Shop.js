import React from "react";

import "./Shop.css";

import ShopCaption from "./ShopCaption";
import Product from "./Product";

class Shop extends React.Component {
  state = {
    selectedProductCode: null,
    listProducts: this.props.listProducts,
  };

  selectProduct = (code) => {
    if (this.state.selectedProductCode === code)
      return this.setState({ selectedProductCode: null });
    else return this.setState({ selectedProductCode: code });
  };

  cbDeleteProduct = (code) => {
    const newListProducts = this.state.listProducts.filter((item) => {
      return item.code !== code;
    });
    return this.setState({ listProducts: newListProducts });
  };

  render() {
    const answersCodeForProduct = this.state.listProducts.map((v) => (
      <Product
        data={v}
        isSelected={v.code === this.state.selectedProductCode}
        cbSelectProduct={this.selectProduct}
        cbDeleteProduct={this.cbDeleteProduct}
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
            <th>Функционал</th>
          </tr>
        </thead>
        <tbody>{answersCodeForProduct}</tbody>
      </table>
    );
  }
}

export default Shop;
