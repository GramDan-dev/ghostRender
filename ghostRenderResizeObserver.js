function ghostRenderResizeObserver(element, ...args) {
    return new Promise((resolve, reject) => {
        // Error handling for invalid element
        if (!element || !(element instanceof HTMLElement)) {
            reject(new Error("Invalid element provided to ghostRenderResizeObserver"));
            return;
        }

        try {
            const clone = element.cloneNode(true);
            const { cloneToElement, elementToClone } = createElementBiMap(clone, element);
            const cloneElementProperties = new Map();
            const renderDiffs = [];

            // Create ResizeObserver to detect size changes
            const observer = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const originalElement = cloneToElement.get(entry.target);
                    
                    if (!originalElement) continue;
                    
                    const currentRect = entry.target.getBoundingClientRect();
                    
                    // Check if we already have measurements for this element
                    if (cloneElementProperties.has(originalElement)) {
                        const previousRect = cloneElementProperties.get(originalElement);
                        renderDiffs.push([[originalElement, previousRect], [entry.target, currentRect]]);
                    } else {
                        // First observation, just store the initial rect
                        cloneElementProperties.set(originalElement, currentRect);
                    }
                }
            });

            // Recursive function to observe all elements in the clone
            function addResizeObserverToAll(element) {
                observer.observe(element);
                Array.from(element.children).forEach(addResizeObserverToAll);
            }
            
            // Execute in a requestAnimationFrame for better timing
            requestAnimationFrame(() => {
                // Create a wrapper to position the clone correctly
                const cloneWrapper = document.createElement("div");
                const elementRect = element.getBoundingClientRect();
                const computedStyle = getComputedStyle(element);
                const marginLeft = parseInt(computedStyle.marginLeft) || 0;
                const marginTop = parseInt(computedStyle.marginTop) || 0;
                
                // Set up the clone wrapper
                Object.assign(cloneWrapper.style, {
                    position: "absolute",
                    left: `${elementRect.x - marginLeft}px`,
                    top: `${elementRect.y - marginTop}px`,
                    pointerEvents: "none"
                });
                
                // Remove accessibility attributes from clone
                clone.removeAttribute('aria-live');
                clone.style.visibility = "hidden";
                
                // Add clone to DOM
                cloneWrapper.appendChild(clone);
                document.body.appendChild(cloneWrapper);
                
                // Start observing all elements
                addResizeObserverToAll(clone);
                
                requestAnimationFrame(() => {
                    // Apply the style changes to trigger resize observations
                    args.forEach(([target, styles]) => {
                        const cloneTarget = elementToClone.get(target);
                        if (cloneTarget) {
                            Object.assign(cloneTarget.style, styles);
                        }
                    });
                    
                    // Wait for ResizeObserver to detect changes
                    requestAnimationFrame(() => {
                        try {
                            // Process the changes
                            const result = renderDiffs.map(diff => ({
                                element: diff[0][0],
                                changes: findRectDiff(diff[0][1], diff[1][1])
                            }));
                            
                            // Clean up
                            observer.disconnect();
                            cloneWrapper.remove();
                            resolve(result);
                        } catch (error) {
                            observer.disconnect();
                            cloneWrapper.remove();
                            reject(error);
                        }
                    });
                });
            });
        } catch (error) {
            reject(error);
        }

        // Helper function to find differences between two rect objects
        function findRectDiff(prevRect, newRect) {
            const result = {};
            
            for (const key in prevRect) {
                // Only add to result if values are different
                if (prevRect[key] !== newRect[key]) {
                    result[key] = [prevRect[key], newRect[key]];
                }
            }
            
            return result;
        }

        // Create bidirectional mapping between original and cloned elements
        function createElementBiMap(cloneElement, originalElement) {
            const cloneToElement = new Map();
            const elementToClone = new Map();
            
            const cloneElements = [cloneElement, ...cloneElement.querySelectorAll("*")];
            const originalElements = [originalElement, ...originalElement.querySelectorAll("*")];
            
            const minLength = Math.min(cloneElements.length, originalElements.length);
            
            for (let i = 0; i < minLength; i++) {
                const clone = cloneElements[i];
                const original = originalElements[i];
                
                cloneToElement.set(clone, original);
                elementToClone.set(original, clone);
            }
            
            return { cloneToElement, elementToClone };
        }
    });
}