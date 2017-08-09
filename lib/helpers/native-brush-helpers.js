import { Selection } from "victory-core";
import { assign, throttle, isFunction, isEqual, defaults } from "lodash";
import { RawBrushHelpers } from "victory-chart/src";
import { Platform } from "react-native";

const Helpers = {
  ...RawBrushHelpers,
  onTouchStart(evt, targetProps) {
    if (Platform.isTVOS) {
      return this.onTVTrackpadTouchStart(evt, targetProps);
    } else {
      return this.onMouseDown(evt, targetProps);
    }
  },
  onTouchMove(evt, targetProps) {
    if (Platform.isTVOS) {
      return this.onTVTrackpadTouchMove(evt, targetProps);
    } else {
      return this.onMouseMove(evt, targetProps);
    }
  },
  onTouchEnd(evt, targetProps) {
    if (Platform.isTVOS) {
      return this.onTVTrackpadTouchEnd(evt, targetProps);
    } else {
      return this.onMouseUp(evt, targetProps);
    }
  },
  onTVTrackpadTouchStart(evt, targetProps) { // eslint-disable-line max-statements
    evt.preventDefault();
    const {
      dimension, handleWidth, onDomainChange, cachedSelectedDomain, domain
    } = targetProps;
    const selectedDomain = defaults({}, targetProps.selectedDomain, domain);
    const fullDomainBox = targetProps.fullDomainBox ||
      this.getDomainBox(targetProps, domain);
    const currentDomain = isEqual(selectedDomain, cachedSelectedDomain) ?
      targetProps.currentDomain || selectedDomain || domain : selectedDomain || domain;
    const { x, y } = Selection.getSVGEventCoordinates(evt);
    const domainBox = this.getDomainBox(targetProps, domain, currentDomain);
    return [{
      target: "parent",
      mutation: () => {
        return {
          isSelecting: true, domainBox, fullDomainBox,
          startX: x,
          startY: y,
          cachedSelectedDomain: selectedDomain,
          currentDomain: currentDomain,
          ...this.getSelectionMutation({ x, y }, domainBox, dimension)
        };
      }
    }];
  },

  onTVTrackpadTouchMove(evt, targetProps) { // eslint-disable-line max-statements
    // if a selection has not been started, ignore the event
    if (!targetProps.isSelecting) {
      return {};
    }
    const {
      startX, startY, domainBox, polar,
      dimension, scale, isPanning, isSelecting, fullDomainBox, onDomainChange
    } = targetProps;
    const { x, y } = Selection.getSVGEventCoordinates(evt);
    const mouseDeltaX = x - startX;
    const mouseDeltaY = startY - y;
    var newDomainBox = this.constrainBox({
      x1: domainBox.x1 + mouseDeltaX + mouseDeltaY,
      x2: domainBox.x2 + mouseDeltaX - mouseDeltaY,
      y1: domainBox.y1,
      y2: domainBox.y2,
    }, fullDomainBox);
    newDomainBox.scale = scale;
    newDomainBox.polar = polar || false;

    const currentDomain = Selection.getBounds(newDomainBox);
    const x1 = newDomainBox.x1;
    const x2 = newDomainBox.x2;


      if (isFunction(onDomainChange)) {
        onDomainChange(currentDomain);
      }
      return [{
        target: "parent",
        mutation: () => {
          return {
            x1, x2, currentDomain
          };
        }
      }]

  },

  onTVTrackpadTouchEnd(evt, targetProps) {
    const { x1, y1, x2, y2, onDomainChange, domain } = targetProps;
    return [{
      target: "parent",
      mutation: () => ({ isPanning: false, isSelecting: false })
    }];
  },

  getDomainBox(props, fullDomain, selectedDomain) {
    const { dimension } = props;
    fullDomain = defaults({}, fullDomain, props.domain);
    selectedDomain = defaults({}, selectedDomain, fullDomain);
    const fullCoordinates = Selection.getDomainCoordinates(props, fullDomain);
    const selectedCoordinates = Selection.getDomainCoordinates(props, selectedDomain);

    return {
      x1: dimension !== "y" ? Math.min(...selectedCoordinates.x) : Math.min(...fullCoordinates.x),
      x2: dimension !== "y" ? Math.max(...selectedCoordinates.x) : Math.max(...fullCoordinates.x),
      y1: dimension !== "x" ? Math.min(...selectedCoordinates.y) : Math.min(...fullCoordinates.y),
      y2: dimension !== "x" ? Math.max(...selectedCoordinates.y) : Math.max(...fullCoordinates.y)
    };
  },

  constrainBox(box, fullDomainBox) {
    const { x1, y1, x2, y2 } = fullDomainBox;
    return {
      x1: box.x2 > x2 ? x2 - Math.abs(box.x2 - box.x1) : Math.max(box.x1, x1),
      y1: box.y2 > y2 ? y2 - Math.abs(box.y2 - box.y1) : Math.max(box.y1, y1),
      x2: box.x1 < x1 ? x1 + Math.abs(box.x2 - box.x1) : Math.min(box.x2, x2),
      y2: box.y1 < y1 ? y1 + Math.abs(box.y2 - box.y1) : Math.min(box.y2, y2)
    };
  },

  getSelectionMutation(point, box, dimension) {
    const { x, y } = point;
    const { x1, x2, y1, y2 } = box;
    return {
      x1: dimension !== "y" ? x : x1,
      y1: dimension !== "x" ? y : y1,
      x2: dimension !== "y" ? x : x2,
      y2: dimension !== "x" ? y : y2
    };
  },



};

const makeThrottledHandler = (handler) => {
  const throttledHandler = throttle(handler, 16, { leading: true });
  return (evt, ...otherParams) => {
    evt.persist(); // ensure that the react native event is persisted!
    return throttledHandler(evt, ...otherParams);
  };
};

export default {
  onTouchStart: Helpers.onTouchStart.bind(Helpers),
  onTouchEnd: Helpers.onTouchEnd.bind(Helpers),
  onTouchMove: makeThrottledHandler(Helpers.onTouchMove.bind(Helpers))
};
