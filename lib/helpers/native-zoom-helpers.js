import { throttle, isFunction, defaults } from "lodash";
import { Dimensions, Platform } from "react-native";
import { Collection } from "victory-core/src";
import { RawZoomHelpers } from "victory-chart/src";
import { Selection } from "victory-core";

const hypotenuse = (x, y) => Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));

const screenSize = hypotenuse(Dimensions.get("window").width, Dimensions.get("window").height);

const Helpers = {
  ...RawZoomHelpers,
  onTouchEnd() {
    return [{
      target: "parent",
      mutation: () => {
        return { panning: false, originalPinchDistance: null };
      }
    }];
  },
  onTouchStart(evt, targetProps) {
    if (Platform.isTVOS) {
      return this.onTVTrackpadTouchStart(evt, targetProps);
    } else {
      return this.onMouseDown(evt);
    }
  },
  onTouchMove(evt, targetProps, eventKey, ctx) {
    if (Platform.isTVOS) {
      return this.onTVTrackpadTouchMove(evt, targetProps, eventKey, ctx);
    } else {
      return this.onMouseMove(evt, targetProps, eventKey, ctx);
    }
  },
  onTouchPinch(evt, targetProps, eventKey, ctx) { // eslint-disable-line max-params
    const { onDomainChange, dimension, domain, zoomDomain } = targetProps;
    const { touches } = evt.nativeEvent;
    if (!targetProps.allowZoom) {
      return {};
    }
    const originalDomain = this.getDomain(targetProps);
    const lastDomain = defaults(
      {}, targetProps.currentDomain || zoomDomain || originalDomain, domain
    );
    const { x, y } = lastDomain;
    const currentDomain = {
      x: dimension === "y" ? lastDomain.x : this.scaleNative(x, evt, targetProps, "x"),
      y: dimension === "x" ? lastDomain.y : this.scaleNative(y, evt, targetProps, "y")
    };
    const resumeAnimation = this.handleAnimation(ctx);
    const originalPinchDistance =
      targetProps.originalPinchDistance || this.getPinchDistance(touches);
    if (isFunction(onDomainChange)) {
      onDomainChange(currentDomain);
    }
    return [{
      target: "parent",
      callback: resumeAnimation,
      mutation: () => {
        return {
          domain: currentDomain, currentDomain, originalDomain, cachedZoomDomain: zoomDomain,
          parentControlledProps: ["domain"], panning: false, originalPinchDistance
        };
      }
    }];
  },
  getPinchDistance([a, b]) {
    return hypotenuse(b.locationX - a.locationX, b.locationY - a.locationY);
  },
  getScaleFactorNative(evt, props) {
    const { originalPinchDistance } = props;
    const { touches } = evt.nativeEvent;

    if (!originalPinchDistance) { return 1; } // if the first pinch event, don't do anything

    const currentPinchDistance = this.getPinchDistance(touches);
    const scaledPinchChange = (currentPinchDistance - originalPinchDistance) / screenSize;
    return 1 - scaledPinchChange;
  },
  scaleNative(currentDomain, evt, props, axis) { // eslint-disable-line max-params
    const [from, to] = currentDomain;
    const range = Math.abs(to - from);
    const minimumZoom = props.minimumZoom && props.minimumZoom[axis];
    const factor = this.getScaleFactorNative(evt, props);
    if (minimumZoom && range <= minimumZoom && factor < 1) {
      return currentDomain;
    }
    const [fromBound, toBound] = this.getDomain(props)[axis];
    const percent = this.getScalePercent(evt, props, axis);
    const point = (factor * from) + percent * (factor * range);
    const minDomain = this.getMinimumDomain(point, props, axis);
    const [newMin, newMax] = this.getScaledDomain(currentDomain, factor, percent);
    const newDomain = [
      newMin > fromBound && newMin < toBound ? newMin : fromBound,
      newMax < toBound && newMax > fromBound ? newMax : toBound
    ];
    const domain = Math.abs(minDomain[1] - minDomain[0]) > Math.abs(newDomain[1] - newDomain[0]) ?
      minDomain : newDomain;
    return Collection.containsDates([fromBound, toBound]) ?
      [ new Date(domain[0]), new Date(domain[1]) ] : domain;
  },

  onTVTrackpadTouchStart(evt, targetProps) {
    evt.preventDefault();
    const { x, y } = Selection.getSVGEventCoordinates(evt);
    return [{
      target: "parent",
      mutation: () => {
        return {
          startX: x, startY: y, panning: false, scaling: false,
          parentControlledProps: ["domain"]
        };
      }
    }];
  },

  onTVTrackpadTouchMove(evt, targetProps, eventKey, ctx) {
    const { startX, startY, panning, scaling } = targetProps;
    const { x, y } = Selection.getSVGEventCoordinates(evt);
    if (panning) {
      return this.onMouseMove(evt, targetProps, eventKey, ctx, true);
    } else if (scaling) {
      evt.deltaY = y - startY;
      return this.onWheel(evt, targetProps, eventKey, ctx);
    } else {
      const absDeltaX = Math.abs(x - startX);
      const absDeltaY = Math.abs(y - startY);
      const panning = absDeltaX > absDeltaY;
      const scaling = !panning;
      return [{
        target: "parent",
        mutation: () => {
          return {
            panning: panning,
            scaling: scaling
          };
        }
      }];
    }
  },

  onTVTrackpadTouchEnd(evt) {
    return [{
      target: "parent",
      mutation: () => {
        return {
          panning: false,
          scaling: false
        };
      }
    }];
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
  onTouchMove: makeThrottledHandler(Helpers.onTouchMove.bind(Helpers)),
  onTouchPinch: makeThrottledHandler(Helpers.onTouchPinch.bind(Helpers))
};
