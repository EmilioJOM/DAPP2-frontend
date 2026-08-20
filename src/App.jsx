import { Routes, Route, Link } from "react-router";

import Home from "./pages/Home";

function App() {
  return (
    <>
      <nav>
        <Link to="/">Inicio</Link>
        {" | "}
        {"Otras paginas"}
        {" | "}
        {"Otras paginas"}
        {" | "}
        {"Otras paginas"}
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </>
  );
}

export default App;
