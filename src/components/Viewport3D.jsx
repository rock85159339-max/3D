import React from 'react';

const Viewport3D = React.forwardRef(function Viewport3D({ children }, ref) {
  return (
    <section className="viewport-wrap">
      {children}
      <div ref={ref} className="three-viewport" />
    </section>
  );
});

export default Viewport3D;
