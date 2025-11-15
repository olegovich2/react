import React from "react";

import "./Filter.css";

import Word from "./Word";

class Filter extends React.Component {
  state = {
    checked: false,
    filter: "",
    words: this.props.listWords,
  };

  render() {
    const resetButton = () => {
      this.setState({
        checked: false,
        filter: "",
        words: this.props.listWords,
      });
    };

    const sort = (eo) => {
      this.setState({ checked: eo.target.checked }, sortedFilter);
    };

    const filter = (eo) => {
      this.setState({ filter: eo.target.value }, sortedFilter);
    };

    const sortedFilter = () => {
      let words = [...this.props.listWords];
      if (this.state.filter) {
        words = words.filter((element) => element.includes(this.state.filter));
      }
      if (this.state.checked) words = words.toSorted();
      this.setState({ words: words });
    };

    const wordFromList = this.state.words.map((v, index) => (
      <Word value={v} key={index} />
    ));

    return (
      <div>
        <div>
          <input
            name="checkbox"
            type="checkbox"
            onChange={sort}
            checked={this.state.checked}
          />
          <input
            name="inputForFilter"
            type="text"
            onChange={filter}
            value={this.state.filter}
          />
          <input type="button" value="Сброс" onClick={resetButton} />
        </div>
        <div className="tableScroll">
          <table>
            <tbody>{wordFromList}</tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default Filter;
