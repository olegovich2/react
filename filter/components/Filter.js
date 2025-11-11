import React from "react";

import "./Filter.css";

import Word from "./Word";

class Filter extends React.Component {
  state = {
    originList: this.props.listWords,
    isChecked: false,
    isFilter: false,
    sortList: [],
    filterList: [],
    mixList: [],
    letter: "",
  };

  render() {
    let wordFromList;

    const resetButton = () => {
      this.setState({ isChecked: false, isFilter: false, letter: "" });
    };

    const sortAndFilter = (eo) => {
      if (eo.target.name === "checkbox") {
        this.state.isChecked = eo.target.checked;
      } else if (
        eo.target.name === "inputForFilter" &&
        eo.target.value.length === 0
      ) {
        this.state.letter = eo.target.value;
        this.state.isFilter = false;
      } else if (
        eo.target.name === "inputForFilter" &&
        eo.target.value.length > 0
      ) {
        this.state.letter = eo.target.value;
        this.state.isFilter = true;
      }

      if (this.state.isChecked && !this.state.isFilter) {
        const sortList = [...this.state.originList].sort();
        this.setState({ sortList: sortList });
      } else if (!this.state.isChecked && this.state.isFilter) {
        const filterList = [...this.state.originList].filter((element) =>
          element.includes(this.state.letter)
        );
        this.setState({ filterList: filterList });
      } else if (this.state.isChecked && this.state.isFilter) {
        if (this.state.sortList.length === 0) {
          const originCopy = [...this.props.listWords];
          const mixList = [...this.state.filterList].sort();
          this.setState({
            mixList: mixList,
            filterList: originCopy.filter((element) =>
              element.includes(this.state.letter)
            ),
          });
        } else {
          const originCopy = [...this.props.listWords];
          const mixList = [...this.state.sortList].filter((element) =>
            element.includes(this.state.letter)
          );
          this.setState({ mixList: mixList, sortList: originCopy.sort() });
        }
      } else {
        this.setState({
          originList: this.props.listWords,
        });
      }
    };

    if (!this.state.isChecked && !this.state.isFilter) {
      wordFromList = this.state.originList.map((v, index) => (
        <Word value={v} key={index} />
      ));
    } else if (this.state.isChecked && !this.state.isFilter) {
      wordFromList = this.state.sortList.map((v, index) => (
        <Word value={v} key={index} />
      ));
    } else if (!this.state.isChecked && this.state.isFilter) {
      wordFromList = this.state.filterList.map((v, index) => (
        <Word value={v} key={index} />
      ));
    } else if (this.state.isChecked && this.state.isFilter) {
      wordFromList = this.state.mixList.map((v, index) => (
        <Word value={v} key={index} />
      ));
    }

    return (
      <div>
        <div>
          <input
            name="checkbox"
            type="checkbox"
            onChange={sortAndFilter}
            checked={this.state.isChecked}
          />
          <input
            name="inputForFilter"
            type="text"
            onChange={sortAndFilter}
            value={this.state.letter}
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
