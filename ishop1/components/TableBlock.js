import React from "react";

import "./TableBlock.css";

import ShopCaption from "./ShopCaption";
import TheadContent from "./TheadContent";
import TbodyContent from "./TbodyContent";

class TableBlock extends React.Component {
  render() {
    const answersCode = this.props.answers.map((v) => (
      <TheadContent
        isLink={v.isLink}
        key={v.code}
        name={v.name}
        price={v.price}
        residual={v.residual}
        url={v.url}
      />
    ));
    const answersCodeForTbody = this.props.answers.map((v) => (
      <TbodyContent
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

export default TableBlock;
