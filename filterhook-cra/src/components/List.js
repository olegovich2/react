import React from "react";
import PropTypes from "prop-types";

const List = ({ words }) => {
  if (words.length === 0) {
    return (
      <div className="tableScroll">
        <p>Нет элементов, соответствующих фильтру</p>
      </div>
    );
  }

  return (
    <div className="tableScroll">
      <table>
        <tbody>
          {words.map((value, index) => (
            <tr key={index}>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

List.propTypes = {
  words: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default List;
