import React from "react";

class Word extends React.Component {
  render() {
    return (
      <tr>
        <td>{this.props.value}</td>
      </tr>
    );
  }
}

export default Word;
