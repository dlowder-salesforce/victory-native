import React from "react";
import PropTypes from "prop-types";
import { Rect, G } from "react-native-svg";
import { last } from "lodash";
import { VictoryContainer, NativeHelpers, NativeBrushHelpers } from "../index";
import { Platform } from "react-native";

// ensure the selection component get native styles
const RectWithStyle = ({ style, ...otherProps }) =>
  <Rect {...otherProps} {...NativeHelpers.getStyle(style)} />;

RectWithStyle.propTypes = {
  style: PropTypes.object
};

export const brushContainerMixin = (base) => class VictoryNativeSelectionContainer extends base { // eslint-disable-line max-len
  static defaultProps = {
    ...VictoryContainer.defaultProps,
    selectionStyle: {
      stroke: "transparent",
      fill: "black",
      fillOpacity: 0.1
    },
    handleStyle: {
      stroke: "transparent",
      fill: "transparent"
    },
    handleWidth: 8,
    selectionComponent: <RectWithStyle/>,
    handleComponent: <RectWithStyle/>
  };

  static defaultEvents = [{
    target: "parent",
    eventHandlers: {
      onTouchStart: (evt, targetProps) => {
        return NativeBrushHelpers.onTouchStart(evt, targetProps);
      },
      onTouchMove: (evt, targetProps) => {
        const mutations = NativeBrushHelpers.onTouchMove(evt, targetProps);

        if (mutations.id !== this.touchMoveMutationId) { // eslint-disable-line
          this.touchMoveMutationId = mutations.id; // eslint-disable-line
          return mutations.mutations;
        }

        return [];
      },
      onTouchEnd: (evt, targetProps) => {
        return NativeBrushHelpers.onTouchEnd(evt, targetProps);
      },
    }
  }];

  getChildren(props) {
    const { children } = props; // eslint-disable-line react/prop-types
    const lastChild = last(children);
    // replace the web's getChildren's <g> with <G> from react-native-svg
    if (lastChild && lastChild.type === "g") {
      children[children.length - 1] = (
        <G key="brush-group">
          {lastChild.props.children}
        </G>
      );
    }
    return children;
  }
};
