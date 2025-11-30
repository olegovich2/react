import React from "react";
import PropTypes from "prop-types";

const Controls = ({
  onSortChange,
  onFilterChange,
  onReset,
  filterValue,
  sortChecked,
}) => {
  const handleSort = (eo) => {
    onSortChange(eo.target.checked);
  };

  const handleFilter = (eo) => {
    onFilterChange(eo.target.value);
  };

  return (
    <div className="controls">
      <label className="control-item">
        <input
          type="checkbox"
          name="sort"
          onChange={handleSort}
          checked={sortChecked}
        />
        Сортировать по алфавиту
      </label>

      <label className="control-item">
        Фильтр:
        <input
          type="text"
          name="filter"
          onChange={handleFilter}
          value={filterValue}
          placeholder="Введите текст для фильтрации"
        />
      </label>

      <div className="control-item">
        <button onClick={onReset}>Сброс</button>
      </div>
    </div>
  );
};

Controls.propTypes = {
  onSortChange: PropTypes.func.isRequired,
  onFilterChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  filterValue: PropTypes.string.isRequired,
  sortChecked: PropTypes.bool.isRequired,
};

export default Controls;
