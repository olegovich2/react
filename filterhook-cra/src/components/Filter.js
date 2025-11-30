import React, { useState, useCallback, useMemo } from "react";
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

  const processedWords = useMemo(() => {
    let processedWords = [...listWords];
    if (filter) {
      processedWords = processedWords.filter((word) => word.includes(filter));
    }
    if (isSorted) {
      processedWords = [...processedWords].sort();
    }
    return processedWords;
  }, [listWords, filter, isSorted]);

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
