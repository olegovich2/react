import React from "react";

class TitleColumns extends React.Component {
  render() {
    if (!this.props.isLink) {
      return (
        <tr>
          <td>{this.props.name}</td>
          <td>{this.props.price}</td>
          <td>{this.props.residual}</td>
          <td>{this.props.url}</td>
        </tr>
      );
    } else return null;
  }
}

export default TitleColumns;
