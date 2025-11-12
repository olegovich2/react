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
      switch (eo.target.name) {
        case "checkbox":
          this.state.isChecked = eo.target.checked;
          break;
        case "inputForFilter":
          if (eo.target.value.length === 0) {
            this.state.letter = eo.target.value;
            this.state.isFilter = false;
          } else if (eo.target.value.length > 0) {
            this.state.letter = eo.target.value;
            this.state.isFilter = true;
          }
          break;
      }

      const stateCode =
        (this.state.isChecked ? 1 : 0) + (this.state.isFilter ? 2 : 0);

      switch (stateCode) {
        case 1: // isChecked: true, isFilter: false
          const sortList = [...this.state.originList].sort();
          this.setState({ sortList: sortList });
          break;
        case 2: // isChecked: false, isFilter: true
          const filterList = [...this.state.originList].filter((element) =>
            element.includes(this.state.letter)
          );
          this.setState({ filterList: filterList });
          break;
        case 3: // isChecked: true, isFilter: true
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
          break;
        case 0: // isChecked: false, isFilter: false
        default:
          this.setState({
            originList: this.props.listWords,
          });
          break;
      }
    };

    const cases = [
      { checked: false, filter: false, list: "originList" },
      { checked: true, filter: false, list: "sortList" },
      { checked: false, filter: true, list: "filterList" },
      { checked: true, filter: true, list: "mixList" },
    ];

    const currentCase = cases.find(
      (c) =>
        c.checked === this.state.isChecked && c.filter === this.state.isFilter
    );

    if (currentCase) {
      wordFromList = this.state[currentCase.list].map((v, index) => (
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
