import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import Controls from "./Controls";
import List from "./List";
import "./Filter.css";

const Filter = ({ listWords }) => {
  const [filter, setFilter] = useState("");
  const [isSorted, setIsSorted] = useState(false);

  const handleSortChange = useCallback((checked) => {
    setIsSorted(checked);
  }, []);

  const handleFilterChange = useCallback((value) => {
    setFilter(value);
  }, []);

  const handleReset = useCallback(() => {
    setFilter("");
    setIsSorted(false);
  }, []);

  const processWords = () => {
    let processedWords = [...listWords];
    if (filter) {
      processedWords = [...listWords].filter((word) => word.includes(filter));
    }
    if (isSorted) {
      processedWords = [...processedWords].sort();
    }

    return processedWords;
  };

  const processedWords = processWords();

  return (
    <div>
      <Controls
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filterValue={filter}
        sortChecked={isSorted}
      />
      <List words={processedWords} />
    </div>
  );
};

Filter.propTypes = {
  listWords: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default Filter;
