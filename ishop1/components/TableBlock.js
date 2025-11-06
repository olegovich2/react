import React from "react";

import "./TableBlock.css";

import ShopCaption from "./ShopCaption";
import TableContent from "./TableContent";

class TableBlock extends React.Component {
  render() {
    const answersCode = this.props.answers.map((v) => (
      <TableContent
        isLink={v.isLink}
        name={v.name}
        price={v.price}
        residual={v.residual}
        url={v.url}
      />
    ));

    return (
      <table>
        <ShopCaption caption={this.props.caption} />
        {answersCode}
      </table>
    );
  }
}

export default TableBlock;
